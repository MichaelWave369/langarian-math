#!/usr/bin/env node

import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const REQUEST_SCHEMA = 'governed-rollback-request:v0.1'
const INCIDENT_SCHEMA = 'incident-response-record:v0.1'
const PLAN_SCHEMA = 'rollback-containment-plan:v0.1'
const ARCHIVE_SCHEMA = 'package-release-archive:v0.1'
const OBSERVATION_SCHEMA = 'repository-merge-observation:v0.1'
const ANCHOR_SCHEMA = 'repository-rollback-anchor:v0.1'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument ${token}.`)
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) args[key] = true
    else {
      args[key] = value
      index += 1
    }
  }
  return args
}

function required(args, key) {
  const value = args[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing --${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}.`)
  return value
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

function writeJson(path, value) {
  const target = resolve(path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects NaN and infinity.')
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen))
  if (isRecord(value)) {
    if (seen.has(value)) throw new Error('Canonical JSON rejects cyclic objects.')
    seen.add(value)
    const output = {}
    for (const key of Object.keys(value).sort()) {
      const item = value[key]
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') throw new Error(`Canonical JSON rejects unsupported value at ${key}.`)
      output[key] = canonicalize(item, seen)
    }
    seen.delete(value)
    return output
  }
  throw new Error(`Canonical JSON rejects ${typeof value}.`)
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function without(value, keys) {
  const output = { ...value }
  for (const key of keys) delete output[key]
  return output
}

function verifyEd25519(identity, signature, payload) {
  try {
    const key = createPublicKey({ key: identity.public_key_jwk, format: 'jwk' })
    return verifySignature(null, Buffer.from(canonicalJson(payload)), key, Buffer.from(signature, 'base64url'))
  } catch {
    return false
  }
}

function fingerprintValid(identity) {
  return identity?.id === `authority:${digest(identity.public_key_jwk).slice('sha256:'.length)}`
}

function contentIdValid(prefix, value, idKey) {
  return value?.[idKey] === `${prefix}:${digest(without(value, [idKey])).slice('sha256:'.length)}`
}

function immutableView(value) {
  const output = clone(value)
  output.theory.version = '__VERSION__'
  output.maturity_level = 1
  const metadata = { ...(output.metadata ?? {}) }
  delete metadata.release_governance
  output.metadata = metadata
  return output
}

function validateSignedRecord(record, identity, schema, idKey, prefix, signatureKey, payloadKeys) {
  if (!record || record.schema_version !== schema) throw new Error(`Expected ${schema}.`)
  if (!identity || identity.status !== 'active' || !fingerprintValid(identity)) throw new Error(`${prefix} authority is unknown, inactive, or fingerprint-invalid.`)
  const payload = {}
  for (const key of payloadKeys) payload[key] = record[key]
  if (!verifyEd25519(identity, record[signatureKey], payload)) throw new Error(`${prefix} signature is invalid.`)
  const expected = `${prefix}:${digest({ ...payload, [signatureKey]: record[signatureKey] }).slice('sha256:'.length)}`
  if (record[idKey] !== expected) throw new Error(`${prefix} id does not match its signed body.`)
}

function validateRequest(request, liveManifest, restoreManifest) {
  if (!isRecord(request) || request.request_schema_version !== REQUEST_SCHEMA) throw new Error(`Expected ${REQUEST_SCHEMA}.`)
  const incident = request.incident
  const plan = request.containment_plan
  const observation = request.merge_observation
  const anchor = request.rollback_anchor
  const archive = request.release_archive
  if (!incident || !plan || !observation || !anchor || !archive) throw new Error('Rollback request is incomplete.')
  if (observation.schema_version !== OBSERVATION_SCHEMA || observation.status !== 'MERGED' || !contentIdValid('merge-observation', observation, 'observation_id')) throw new Error('Merge observation is invalid or not content-addressed.')
  if (anchor.schema_version !== ANCHOR_SCHEMA || anchor.status !== 'AVAILABLE_FOR_GOVERNED_ROLLBACK' || !contentIdValid('rollback-anchor', anchor, 'rollback_anchor_id')) throw new Error('Rollback anchor is invalid or not content-addressed.')
  if (observation.rollback_anchor_id !== anchor.rollback_anchor_id || observation.pull_request?.merge_commit !== anchor.merge_commit) throw new Error('Merge observation and rollback anchor are detached.')
  if (anchor.action_applied !== 'PROMOTION') throw new Error('v1.0 rollback materialization requires a promotion-established rollback anchor.')
  if (archive.archive_schema_version !== ARCHIVE_SCHEMA) throw new Error(`Release archive must use ${ARCHIVE_SCHEMA}.`)
  const bundle = archive.release_bundle
  if (bundle?.proposal?.action !== 'ROLLBACK' || bundle?.receipt?.action !== 'ROLLBACK' || bundle?.receipt?.status !== 'AUTHORIZED_NOT_COMMITTED') throw new Error('Release archive is not an authorized uncommitted rollback.')
  if (digest(liveManifest) !== anchor.merged_manifest_hash || digest(liveManifest) !== incident.current_manifest_hash) throw new Error('Live manifest does not match the incident-bound merged rollback anchor.')
  if (digest(restoreManifest) !== anchor.restore_manifest_hash || digest(restoreManifest) !== incident.restore_manifest_hash) throw new Error('Restore manifest does not match the incident-bound rollback anchor.')
  if (canonicalJson(liveManifest) !== canonicalJson(request.current_manifest) || canonicalJson(restoreManifest) !== canonicalJson(request.restore_manifest)) throw new Error('Request manifests differ from trusted repository manifests.')
  if (digest(bundle.before_manifest) !== digest(liveManifest)) throw new Error('Rollback archive before manifest does not match the live manifest.')
  if (canonicalJson(immutableView(bundle.after_manifest)) !== canonicalJson(immutableView(restoreManifest))) throw new Error('Rollback target changes immutable theory content.')
  if (bundle.proposal.authority_decision_id !== anchor.authority_decision_id || archive.signed_authority_decision?.decision_id !== anchor.authority_decision_id) throw new Error('Rollback archive is detached from the anchor-bound authority decision.')

  const authorities = new Map((archive.authority_bundle?.authorities ?? []).map((item) => [item.id, item]))
  const incidentAuthority = authorities.get(incident.declared_by)
  validateSignedRecord(incident, incidentAuthority, INCIDENT_SCHEMA, 'incident_id', 'incident', 'signature', [
    'schema_version', 'incident_type', 'status', 'repository', 'package_id', 'target_path', 'merge_observation_id', 'rollback_anchor_id',
    'current_manifest_hash', 'restore_manifest_hash', 'severity', 'summary', 'observed_effects', 'evidence_references', 'containment_rationale',
    'rollback_objective', 'declared_by', 'declared_at_utc', 'metadata',
  ])
  if (!incidentAuthority.roles?.includes('incident-commander') || !incidentAuthority.authority_scope?.includes('declare:release-incident')) throw new Error('Incident authority lacks required role or scope.')
  if (incident.repository !== anchor.repository || incident.package_id !== liveManifest.theory.id || incident.target_path !== anchor.target_path || incident.merge_observation_id !== observation.observation_id || incident.rollback_anchor_id !== anchor.rollback_anchor_id) throw new Error('Incident declaration is detached from the exact governed release.')
  if (!incident.summary?.trim() || !incident.containment_rationale?.trim() || !incident.rollback_objective?.trim() || !Array.isArray(incident.evidence_references) || incident.evidence_references.length === 0) throw new Error('Incident declaration lacks required narrative or evidence references.')

  const containmentAuthority = authorities.get(plan.approved_by)
  validateSignedRecord(plan, containmentAuthority, PLAN_SCHEMA, 'containment_plan_id', 'containment-plan', 'signature', [
    'schema_version', 'incident_id', 'rollback_anchor_id', 'release_archive_digest', 'release_receipt_id', 'expected_current_manifest_hash',
    'expected_restore_manifest_hash', 'action', 'steps', 'success_conditions', 'stop_conditions', 'monitoring_window_minutes', 'approved_by',
    'approved_at_utc', 'metadata',
  ])
  if (!containmentAuthority.roles?.includes('containment-authority') || !containmentAuthority.authority_scope?.includes('approve:rollback-containment')) throw new Error('Containment authority lacks required role or scope.')
  if (incident.declared_by === plan.approved_by || plan.approved_by === bundle.proposal.release_authority_id) throw new Error('Incident, containment, and release custody separation failed.')
  if (plan.incident_id !== incident.incident_id || plan.rollback_anchor_id !== anchor.rollback_anchor_id) throw new Error('Containment plan is detached from incident or rollback anchor.')
  if (plan.release_archive_digest !== digest(archive) || plan.release_receipt_id !== bundle.receipt.receipt_id) throw new Error('Containment plan is detached from the exact rollback release archive.')
  if (plan.expected_current_manifest_hash !== digest(liveManifest) || plan.expected_restore_manifest_hash !== digest(restoreManifest)) throw new Error('Containment plan manifest expectations are invalid.')
  if (!Array.isArray(plan.steps) || !plan.steps.length || !Array.isArray(plan.success_conditions) || !plan.success_conditions.length || !Array.isArray(plan.stop_conditions) || !plan.stop_conditions.length) throw new Error('Containment controls are incomplete.')
  return { incident, plan, observation, anchor, archive }
}

try {
  const args = parseArgs(process.argv.slice(2))
  const request = readJson(required(args, 'request'))
  const liveManifest = readJson(required(args, 'liveManifest'))
  const restoreManifest = readJson(required(args, 'restoreManifest'))
  const outputDirectory = required(args, 'outDir')
  const validated = validateRequest(request, liveManifest, restoreManifest)
  const handoff = {
    schema_version: 'governed-rollback-handoff:v0.1',
    status: 'READY_FOR_CONTROLLED_WRITER_VALIDATION',
    incident_id: validated.incident.incident_id,
    containment_plan_id: validated.plan.containment_plan_id,
    rollback_anchor_id: validated.anchor.rollback_anchor_id,
    release_receipt_id: validated.archive.release_bundle.receipt.receipt_id,
    release_archive_digest: digest(validated.archive),
    target_path: validated.anchor.target_path,
    application_chain: ['controlled-release-writer', 'controlled application pull request', 'merge reconciliation'],
    prohibited_inferences: ['The package has already been rolled back.', 'The release archive may bypass the controlled writer.', 'The incident or prior release may be deleted.'],
  }
  writeJson(`${outputDirectory}/package-release-archive.json`, validated.archive)
  writeJson(`${outputDirectory}/incident-record.json`, validated.incident)
  writeJson(`${outputDirectory}/containment-plan.json`, validated.plan)
  writeJson(`${outputDirectory}/rollback-anchor.json`, validated.anchor)
  writeJson(`${outputDirectory}/merge-observation.json`, validated.observation)
  writeJson(`${outputDirectory}/rollback-handoff.json`, handoff)
  process.stdout.write(`${JSON.stringify(handoff)}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
