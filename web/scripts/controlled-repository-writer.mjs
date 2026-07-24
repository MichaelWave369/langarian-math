#!/usr/bin/env node

import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const PLAN_SCHEMA = 'repository-writer-plan:v0.1'
const APPLICATION_SCHEMA = 'repository-application-receipt:v0.1'
const LEDGER_SCHEMA = 'repository-replay-ledger:v0.1'
const POLICY_SCHEMA = 'repository-writer-policy:v0.1'
const ARCHIVE_SCHEMA = 'package-release-archive:v0.1'
const RELEASE_BUNDLE_SCHEMA = 'package-release-bundle:v0.1'
const AUTHORITY_POLICY = {
  minimumRollbackApprovals: 2,
  minimumDomains: 2,
  requiredRoles: ['mathematical-review', 'implementation-audit'],
  mandateIssuerScope: 'issue:promotion-mandate',
  appealScope: 'appeal:promotion-decision',
  rollbackScope: 'rollback:promotion-decision',
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const args = { command }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument ${token}.`)
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    const value = rest[index + 1]
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

function readJson(file) {
  return JSON.parse(readFileSync(resolve(file), 'utf8'))
}

function writeJson(file, value) {
  const target = resolve(file)
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

function dateMs(value) {
  return Date.parse(value)
}

function within(now, start, end) {
  const current = dateMs(now)
  return Number.isFinite(current) && Number.isFinite(dateMs(start)) && Number.isFinite(dateMs(end)) && current >= dateMs(start) && current <= dateMs(end)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function without(record, keys) {
  const value = { ...record }
  for (const key of keys) delete value[key]
  return value
}

function identityMap(bundle) {
  return new Map((bundle.authorities ?? []).map((identity) => [identity.id, identity]))
}

function decisionPayload(decision) {
  return {
    schema_version: decision.schema_version,
    signed_schema_version: decision.signed_schema_version,
    decision_type: decision.decision_type,
    assessment_id: decision.assessment_id,
    package: decision.package,
    policy: decision.policy,
    quorum: decision.quorum,
    mandate_ids: decision.mandate_ids,
    status: decision.status,
    blockers: decision.blockers,
    warnings: decision.warnings,
    issued_at_utc: decision.issued_at_utc,
    expires_at_utc: decision.expires_at_utc,
    recorded_by: decision.recorded_by,
    claims_supported: decision.claims_supported,
    prohibited_inferences: decision.prohibited_inferences,
  }
}

function verifyDecision(decision, authorities, now) {
  const recorder = authorities.get(decision.recorded_by)
  const payload = decisionPayload(decision)
  const signatureValid = Boolean(recorder && verifyEd25519(recorder, decision.signature, payload))
  const idValid = decision.decision_id === `authority-decision:${digest({ ...payload, signature: decision.signature }).slice('sha256:'.length)}`
  const recorderValid = Boolean(recorder && recorder.status === 'active' && recorder.authority_scope?.includes('record:promotion-decision') && fingerprintValid(recorder))
  const timeValid = within(now, decision.issued_at_utc, decision.expires_at_utc)
  return { accepted: signatureValid && idValid && recorderValid && timeValid, cryptographic: signatureValid && idValid && recorderValid, signatureValid, idValid, recorderValid, timeValid }
}

function validAppeals(decision, bundle, authorities) {
  const valid = []
  for (const appeal of (bundle.appeals ?? []).filter((item) => item.decision_id === decision.decision_id)) {
    const authority = authorities.get(appeal.authority_id)
    const payload = without(appeal, ['appeal_id', 'signature'])
    const idValid = appeal.appeal_id === `appeal:${digest({ ...payload, signature: appeal.signature }).slice('sha256:'.length)}`
    const authorityValid = Boolean(authority && authority.status === 'active' && authority.authority_scope?.includes(AUTHORITY_POLICY.appealScope) && fingerprintValid(authority))
    if (authorityValid && idValid && verifyEd25519(authority, appeal.signature, payload)) valid.push(appeal.appeal_id)
  }
  return valid
}

function supersededMandates(bundle) {
  return new Set((bundle.mandates ?? []).flatMap((item) => item.supersedes ?? []))
}

function validRollback(decision, bundle, authorities, now) {
  const mandates = new Map((bundle.mandates ?? []).map((item) => [item.mandate_id, item]))
  const superseded = supersededMandates(bundle)
  const accepted = []
  const domains = []
  const roles = []
  const seen = new Set()
  for (const ballot of (bundle.rollback_ballots ?? []).filter((item) => item.decision_id === decision.decision_id)) {
    const authority = authorities.get(ballot.authority_id)
    const mandate = mandates.get(ballot.mandate_id)
    const issuer = mandate ? authorities.get(mandate.issuer_id) : null
    const ballotPayload = without(ballot, ['rollback_ballot_id', 'signature'])
    const mandatePayload = mandate ? without(mandate, ['mandate_id', 'signature']) : null
    const ballotValid = Boolean(
      authority &&
      authority.status === 'active' &&
      authority.authority_scope?.includes(AUTHORITY_POLICY.rollbackScope) &&
      fingerprintValid(authority) &&
      verifyEd25519(authority, ballot.signature, ballotPayload) &&
      ballot.rollback_ballot_id === `rollback-ballot:${digest({ ...ballotPayload, signature: ballot.signature }).slice('sha256:'.length)}`,
    )
    const mandateValid = Boolean(
      mandate && issuer &&
      issuer.status === 'active' && issuer.authority_scope?.includes(AUTHORITY_POLICY.mandateIssuerScope) &&
      fingerprintValid(issuer) && fingerprintValid(authority) &&
      verifyEd25519(issuer, mandate.signature, mandatePayload) &&
      mandate.mandate_id === `mandate:${digest({ ...mandatePayload, signature: mandate.signature }).slice('sha256:'.length)}` &&
      mandate.subject_authority_id === authority.id &&
      mandate.package_id === decision.package.id && mandate.package_version === decision.package.version &&
      mandate.target_level === decision.package.target_level && mandate.scopes?.includes(AUTHORITY_POLICY.rollbackScope) &&
      authority.roles?.includes(mandate.role) && !superseded.has(mandate.mandate_id) &&
      within(now, mandate.valid_from_utc, mandate.expires_at_utc),
    )
    const bindingValid = ballot.package_id === decision.package.id && ballot.package_version === decision.package.version && ballot.target_level === decision.package.target_level
    const unique = !seen.has(ballot.authority_id)
    seen.add(ballot.authority_id)
    if (ballotValid && mandateValid && bindingValid && unique) {
      accepted.push(ballot.rollback_ballot_id)
      domains.push(...(authority.independence_domains ?? []))
      roles.push(mandate.role)
    }
  }
  const distinctDomains = new Set(domains)
  const coveredRoles = new Set(roles)
  return decision.status === 'APPROVED_PENDING_PACKAGE_UPDATE' &&
    accepted.length >= AUTHORITY_POLICY.minimumRollbackApprovals &&
    distinctDomains.size >= AUTHORITY_POLICY.minimumDomains &&
    AUTHORITY_POLICY.requiredRoles.every((role) => coveredRoles.has(role))
}

function proposalPayload(proposal) {
  return without(proposal, ['proposal_id', 'signature'])
}

function receiptPayload(receipt) {
  return without(receipt, ['receipt_id', 'signature'])
}

function applyPatch(before, patch) {
  const after = clone(before)
  for (const operation of patch) {
    if (operation.path === '/theory/version') after.theory.version = String(operation.value)
    else if (operation.path === '/maturity_level') after.maturity_level = Number(operation.value)
    else if (operation.path === '/metadata/release_governance') after.metadata = { ...after.metadata, release_governance: clone(operation.value) }
    else throw new Error(`Patch path ${operation.path} is not allowed.`)
  }
  return after
}

function immutableView(value) {
  const output = clone(value)
  output.theory.version = '__MUTABLE_VERSION__'
  output.maturity_level = 1
  const metadata = { ...(output.metadata ?? {}) }
  delete metadata.release_governance
  output.metadata = metadata
  return output
}

function basicPackageValid(value) {
  return isRecord(value) && value.schema_version === 'theory-package:v0.2' && isRecord(value.theory) && typeof value.theory.id === 'string' && typeof value.theory.version === 'string' && Number.isInteger(value.maturity_level) && value.maturity_level >= 1 && value.maturity_level <= 5 && Array.isArray(value.objects) && Array.isArray(value.operators)
}

function verifyReleaseArchive(archive, liveManifest, now) {
  const problems = []
  if (archive.archive_schema_version !== ARCHIVE_SCHEMA) problems.push('Archive schema is unsupported.')
  const decision = archive.signed_authority_decision
  const authorityBundle = archive.authority_bundle
  const releaseBundle = archive.release_bundle
  if (!decision || !authorityBundle || releaseBundle?.bundle_schema_version !== RELEASE_BUNDLE_SCHEMA) problems.push('Archive is missing required governed release records.')
  if (problems.length) return { accepted: false, problems }

  const before = releaseBundle.before_manifest
  const archivedAfter = releaseBundle.after_manifest
  const proposal = releaseBundle.proposal
  const receipt = releaseBundle.receipt
  const authorities = identityMap(authorityBundle)
  const decisionVerification = verifyDecision(decision, authorities, proposal.action === 'ROLLBACK' ? decision.issued_at_utc : now)
  const appealOpen = validAppeals(decision, authorityBundle, authorities).length > 0
  const rollbackAuthorized = validRollback(decision, authorityBundle, authorities, now)
  const decisionGateOpen = proposal.action === 'PROMOTION'
    ? decisionVerification.accepted && decision.status === 'APPROVED_PENDING_PACKAGE_UPDATE' && !appealOpen && !rollbackAuthorized
    : decisionVerification.cryptographic && rollbackAuthorized
  if (!decisionGateOpen) problems.push('Signed authority decision is not operative for the requested action.')

  const releaseAuthority = authorities.get(proposal.release_authority_id)
  const proposalBody = proposalPayload(proposal)
  const proposalSignatureValid = Boolean(releaseAuthority && verifyEd25519(releaseAuthority, proposal.signature, proposalBody))
  const proposalIdValid = proposal.proposal_id === `release-proposal:${digest({ ...proposalBody, signature: proposal.signature }).slice('sha256:'.length)}`
  const requiredScope = proposal.action === 'PROMOTION' ? 'release:package-mutation' : 'release:package-rollback'
  const governanceAuthorities = new Set([decision.recorded_by, ...(decision.quorum?.distinct_authority_ids ?? [])])
  const governanceDomains = new Set(decision.quorum?.independence_domains ?? [])
  const releaseAuthorityValid = Boolean(
    releaseAuthority && releaseAuthority.status === 'active' && fingerprintValid(releaseAuthority) &&
    releaseAuthority.roles?.includes('release-custodian') && releaseAuthority.authority_scope?.includes(requiredScope) &&
    !governanceAuthorities.has(releaseAuthority.id) &&
    releaseAuthority.independence_domains?.some((domain) => !governanceDomains.has(domain)),
  )
  if (!proposalSignatureValid || !proposalIdValid || !releaseAuthorityValid) problems.push('Release proposal signature, identity, role separation, or scope is invalid.')
  if (!within(now, proposal.issued_at_utc, proposal.expires_at_utc)) problems.push('Release proposal is outside its validity window.')

  const allowedPaths = ['/theory/version', '/maturity_level', '/metadata/release_governance']
  const paths = proposal.patch?.map((item) => item.path) ?? []
  const patchValid = proposal.schema_version === 'package-release-proposal:v0.1' && proposal.patch_schema_version === 'package-manifest-patch:v0.1' && proposal.patch?.length === allowedPaths.length && new Set(paths).size === allowedPaths.length && allowedPaths.every((path) => paths.includes(path)) && proposal.patch.every((item) => ['add', 'replace'].includes(item.op))
  if (!patchValid) problems.push('Release patch is not the exact restricted three-path patch.')

  const liveHash = digest(liveManifest)
  const archivedBeforeHash = digest(before)
  if (canonicalJson(liveManifest) !== canonicalJson(before) || proposal.before_manifest_hash !== liveHash || liveHash !== archivedBeforeHash) problems.push('Live source manifest does not match the exact archived before state.')
  if (proposal.package_id !== liveManifest.theory.id || proposal.before_version !== liveManifest.theory.version || proposal.authority_decision_id !== decision.decision_id) problems.push('Release proposal package or decision binding is invalid.')
  if (proposal.patch_digest !== digest({ schema_version: 'package-manifest-patch:v0.1', patch: proposal.patch })) problems.push('Release patch digest is invalid.')

  let computedAfter = null
  if (patchValid) {
    computedAfter = applyPatch(liveManifest, proposal.patch)
    const metadata = computedAfter.metadata?.release_governance
    const targetMaturity = proposal.action === 'PROMOTION' ? decision.package.target_level : decision.package.current_maturity_level
    const actionSourceValid = proposal.action === 'PROMOTION'
      ? liveManifest.theory.version === decision.package.version && liveManifest.maturity_level === decision.package.current_maturity_level
      : liveManifest.maturity_level === decision.package.target_level && liveManifest.metadata?.release_governance?.authority_decision_id === decision.decision_id
    const afterValid = basicPackageValid(computedAfter) && canonicalJson(immutableView(liveManifest)) === canonicalJson(immutableView(computedAfter)) && computedAfter.theory.version === proposal.target_version && computedAfter.maturity_level === targetMaturity && actionSourceValid && metadata?.authority_decision_id === decision.decision_id && metadata?.action === proposal.action && metadata?.prior_manifest_hash === liveHash && metadata?.prior_version === liveManifest.theory.version && metadata?.release_authority_id === proposal.release_authority_id
    if (!afterValid) problems.push('Materialized target manifest violates the authorized transition.')
    if (proposal.after_manifest_hash !== digest(computedAfter) || canonicalJson(computedAfter) !== canonicalJson(archivedAfter)) problems.push('Archived target manifest does not match the signed patch result.')
  }

  const receiptBody = receiptPayload(receipt)
  const receiptSignatureValid = Boolean(releaseAuthority && verifyEd25519(releaseAuthority, receipt.signature, receiptBody))
  const receiptIdValid = receipt.receipt_id === `release-receipt:${digest({ ...receiptBody, signature: receipt.signature }).slice('sha256:'.length)}`
  const replayKey = digest({ decision_id: decision.decision_id, before_hash: proposal.before_manifest_hash, after_hash: proposal.after_manifest_hash, action: proposal.action })
  const receiptBindingValid = receipt.proposal_id === proposal.proposal_id && receipt.authority_decision_id === decision.decision_id && receipt.action === proposal.action && receipt.release_authority_id === proposal.release_authority_id && receipt.integrity?.before_manifest_hash === proposal.before_manifest_hash && receipt.integrity?.after_manifest_hash === proposal.after_manifest_hash && receipt.integrity?.patch_digest === proposal.patch_digest && receipt.integrity?.replay_key === replayKey && receipt.status === 'AUTHORIZED_NOT_COMMITTED' && receipt.repository_commit_status === 'NOT_COMMITTED'
  if (!receiptSignatureValid || !receiptIdValid || !receiptBindingValid) problems.push('Signed release receipt is invalid, blocked, or detached from the exact transition.')

  return {
    accepted: problems.length === 0,
    problems,
    archiveDigest: digest(archive),
    replayKey,
    decision,
    proposal,
    receipt,
    before: liveManifest,
    after: computedAfter,
  }
}

function validatePolicy(policy, packageId, targetPath) {
  if (policy.schema_version !== POLICY_SCHEMA || !Array.isArray(policy.allowed_targets)) throw new Error(`Writer policy must use ${POLICY_SCHEMA}.`)
  const target = policy.allowed_targets.find((item) => item.package_id === packageId)
  if (!target) throw new Error(`Package ${packageId} is not registered for repository writing.`)
  if (target.path !== targetPath) throw new Error(`Target path must be ${target.path} for package ${packageId}.`)
  return target
}

function validateLedger(ledger) {
  if (ledger.schema_version !== LEDGER_SCHEMA || !Array.isArray(ledger.entries)) throw new Error(`Replay ledger must use ${LEDGER_SCHEMA}.`)
}

function runPlan(args) {
  const archive = readJson(required(args, 'archive'))
  const liveManifest = readJson(required(args, 'liveManifest'))
  const policy = readJson(required(args, 'policy'))
  const ledger = readJson(required(args, 'ledger'))
  const targetPath = required(args, 'targetPath')
  const outputDirectory = required(args, 'outDir')
  const now = typeof args.now === 'string' ? args.now : new Date().toISOString()
  validateLedger(ledger)
  validatePolicy(policy, liveManifest.theory.id, targetPath)
  const verification = verifyReleaseArchive(archive, liveManifest, now)
  if (!verification.accepted) throw new Error(`Release archive is not writable:\n- ${verification.problems.join('\n- ')}`)
  if (typeof args.expectedReceiptId === 'string' && args.expectedReceiptId !== verification.receipt.receipt_id) throw new Error('Expected release receipt id does not match the archive.')
  if (ledger.entries.some((entry) => entry.replay_key === verification.replayKey)) throw new Error('Replay key has already been consumed.')
  const unsigned = {
    schema_version: PLAN_SCHEMA,
    status: 'READY_FOR_REVIEW_BRANCH',
    package: { id: liveManifest.theory.id, before_version: liveManifest.theory.version, target_version: verification.after.theory.version },
    action: verification.proposal.action,
    target_path: targetPath,
    archive_digest: verification.archiveDigest,
    authority_decision_id: verification.decision.decision_id,
    release_proposal_id: verification.proposal.proposal_id,
    release_receipt_id: verification.receipt.receipt_id,
    before_manifest_hash: verification.proposal.before_manifest_hash,
    after_manifest_hash: verification.proposal.after_manifest_hash,
    patch_digest: verification.proposal.patch_digest,
    replay_key: verification.replayKey,
    evaluated_at_utc: now,
    repository_write_boundary: 'Create a review branch and pull request only. Direct main-branch mutation is prohibited.',
  }
  const plan = { ...unsigned, plan_id: `writer-plan:${digest(unsigned).slice('sha256:'.length)}` }
  writeJson(`${outputDirectory}/writer-plan.json`, plan)
  writeJson(`${outputDirectory}/after-manifest.json`, verification.after)
  writeJson(`${outputDirectory}/verified-release-archive.json`, archive)
  process.stdout.write(`${JSON.stringify(plan)}\n`)
}

function runFinalize(args) {
  const plan = readJson(required(args, 'plan'))
  const ledger = readJson(required(args, 'ledger'))
  const outputDirectory = required(args, 'outDir')
  const mutationCommit = required(args, 'mutationCommit')
  const applicationBranch = required(args, 'applicationBranch')
  const baseRef = required(args, 'baseRef')
  const baseCommit = required(args, 'baseCommit')
  const repository = required(args, 'repository')
  const workflowRunId = required(args, 'workflowRunId')
  const workflowRunAttempt = required(args, 'workflowRunAttempt')
  const now = typeof args.now === 'string' ? args.now : new Date().toISOString()
  validateLedger(ledger)
  if (plan.schema_version !== PLAN_SCHEMA || plan.status !== 'READY_FOR_REVIEW_BRANCH') throw new Error('Writer plan is not ready for finalization.')
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(mutationCommit) || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(baseCommit)) throw new Error('Commit ids must be 40- or 64-character lowercase hex values.')
  if (ledger.entries.some((entry) => entry.replay_key === plan.replay_key)) throw new Error('Replay key was consumed before finalization.')
  const unsigned = {
    schema_version: APPLICATION_SCHEMA,
    application_type: 'commit-bound-controlled-package-release',
    status: 'APPLIED_ON_REVIEW_BRANCH',
    merge_status: 'NOT_MERGED',
    repository,
    base_ref: baseRef,
    base_commit: baseCommit,
    application_branch: applicationBranch,
    mutation_commit: mutationCommit,
    target_path: plan.target_path,
    package: plan.package,
    action: plan.action,
    archive_digest: plan.archive_digest,
    authority_decision_id: plan.authority_decision_id,
    release_proposal_id: plan.release_proposal_id,
    release_receipt_id: plan.release_receipt_id,
    before_manifest_hash: plan.before_manifest_hash,
    after_manifest_hash: plan.after_manifest_hash,
    patch_digest: plan.patch_digest,
    replay_key: plan.replay_key,
    workflow_identity: {
      provider: 'github-actions-oidc',
      workflow_run_id: workflowRunId,
      workflow_run_attempt: workflowRunAttempt,
      attestation_status: 'PENDING_WORKFLOW_ATTESTATION',
    },
    issued_at_utc: now,
    claims_supported: ['The archived target manifest was committed on the named review branch from the exact recorded base commit.'],
    prohibited_inferences: ['The application branch was merged.', 'The package claims were proved.', 'The Reality Gate passed.', 'Prior manifests or governance records may be deleted.'],
  }
  const receipt = { ...unsigned, application_receipt_id: `repository-application:${digest(unsigned).slice('sha256:'.length)}` }
  const entry = {
    replay_key: plan.replay_key,
    application_receipt_id: receipt.application_receipt_id,
    release_receipt_id: plan.release_receipt_id,
    package_id: plan.package.id,
    action: plan.action,
    target_path: plan.target_path,
    base_commit: baseCommit,
    mutation_commit: mutationCommit,
    application_branch: applicationBranch,
    consumed_at_utc: now,
    merge_status: 'NOT_MERGED',
  }
  const updatedLedger = { ...ledger, entries: [...ledger.entries, entry], metadata: { ...(ledger.metadata ?? {}), last_updated_at_utc: now } }
  const applicationBundle = {
    bundle_schema_version: 'repository-application-bundle:v0.1',
    writer_plan: plan,
    application_receipt: receipt,
    replay_ledger_entry: entry,
    metadata: { attestation_status: 'PENDING_WORKFLOW_ATTESTATION', repository_commit_status: 'REVIEW_BRANCH_ONLY' },
  }
  writeJson(`${outputDirectory}/application-receipt.json`, receipt)
  writeJson(`${outputDirectory}/replay-ledger.json`, updatedLedger)
  writeJson(`${outputDirectory}/application-bundle.json`, applicationBundle)
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.command === 'plan') runPlan(args)
  else if (args.command === 'finalize') runFinalize(args)
  else throw new Error('Usage: controlled-repository-writer.mjs <plan|finalize> [options]')
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
