import { describe, expect, it } from 'vitest'

import { suiteForPackage } from '../../src/theory/conformance.js'
import {
  canonicalEvidenceJson,
  custodyLocatorForSuite,
  emptyCustodyBundle,
  generateLocalSigner,
  parseCustodyBundleJson,
  revokeEvidence,
  sha256EvidenceDigest,
  signEvidenceSubject,
  validateCustodyBundle,
  type EvidenceCustodyBundle,
} from '../../src/theory/custody.js'
import { verifyGovernedCustodyBundle } from '../../src/theory/custodyPolicy.js'
import { BUNDLED_THEORY_PACKAGES } from '../../src/theory/packages.js'

const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!
const suite = suiteForPackage(langarian)!
const locator = custodyLocatorForSuite(suite)
const subjects = { [locator]: suite }

function bundleWithSigner(identity): EvidenceCustodyBundle {
  return {
    ...emptyCustodyBundle(),
    signers: [identity],
    metadata: { test_fixture: true },
  }
}

describe('canonical evidence hashing', () => {
  it('sorts object keys and normalizes negative zero', async () => {
    expect(canonicalEvidenceJson({ z: -0, a: [2, { y: true, x: 'v' }] })).toBe('{"a":[2,{"x":"v","y":true}],"z":0}')
    expect(await sha256EvidenceDigest({ b: 2, a: 1 })).toBe(await sha256EvidenceDigest({ a: 1, b: 2 }))
  })

  it('rejects non-finite and cyclic values', () => {
    expect(() => canonicalEvidenceJson({ bad: Number.NaN })).toThrow(/NaN/)
    const cyclic = {}
    cyclic.self = cyclic
    expect(() => canonicalEvidenceJson(cyclic)).toThrow(/cyclic/)
  })
})

describe('Ed25519 evidence custody', () => {
  it('signs and verifies the exact public conformance suite', async () => {
    const signer = await generateLocalSigner('Test custodian', ['sign:contract-conformance-suite'], '2026-07-23T00:00:00Z')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, {
      signed_at_utc: '2026-07-23T00:01:00Z',
      metadata: { test: true },
    })
    const bundle = bundleWithSigner(signer.identity)
    bundle.envelopes.push(envelope)

    const profile = await verifyGovernedCustodyBundle(bundle, subjects)
    expect(profile.bundle_valid).toBe(true)
    expect(profile.custody_ready).toBe(true)
    expect(profile.signer_results[0]?.fingerprint_valid).toBe(true)
    expect(profile.active_envelopes).toHaveLength(1)
    expect(profile.active_envelopes[0]).toMatchObject({
      evidence_id: envelope.evidence_id,
      digest_valid: true,
      evidence_id_valid: true,
      signature_valid: true,
      accepted: true,
    })
  })

  it('detects subject tampering without changing the signed envelope', async () => {
    const signer = await generateLocalSigner('Tamper test', [], '2026-07-23T00:00:00Z')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, { signed_at_utc: '2026-07-23T00:01:00Z' })
    const bundle = bundleWithSigner(signer.identity)
    bundle.envelopes.push(envelope)
    const alteredSuite = structuredClone(suite)
    alteredSuite.metadata.tampered = true

    const profile = await verifyGovernedCustodyBundle(bundle, { [locator]: alteredSuite })
    expect(profile.custody_ready).toBe(false)
    expect(profile.envelope_results[0]?.digest_valid).toBe(false)
    expect(profile.envelope_results[0]?.issues.some((item) => item.code === 'SUBJECT_DIGEST_MISMATCH')).toBe(true)
  })

  it('supersedes an older valid envelope without deleting it', async () => {
    const signer = await generateLocalSigner('Supersession test', [], '2026-07-23T00:00:00Z')
    const first = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, { signed_at_utc: '2026-07-23T00:01:00Z' })
    const second = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, {
      signed_at_utc: '2026-07-23T00:02:00Z',
      supersedes: [first.evidence_id],
    })
    const bundle = bundleWithSigner(signer.identity)
    bundle.envelopes.push(first, second)

    const profile = await verifyGovernedCustodyBundle(bundle, subjects)
    expect(profile.active_envelopes.map((item) => item.evidence_id)).toEqual([second.evidence_id])
    expect(profile.envelope_results.find((item) => item.evidence_id === first.evidence_id)?.superseded).toBe(true)
    expect(profile.envelope_results.find((item) => item.evidence_id === second.evidence_id)?.accepted).toBe(true)
  })

  it('honors a valid signed self-revocation', async () => {
    const signer = await generateLocalSigner('Revocation test', [], '2026-07-23T00:00:00Z')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, { signed_at_utc: '2026-07-23T00:01:00Z' })
    const revocation = await revokeEvidence(envelope.evidence_id, signer, 'Fixture withdrawn.', { issued_at_utc: '2026-07-23T00:02:00Z' })
    const bundle = bundleWithSigner(signer.identity)
    bundle.envelopes.push(envelope)
    bundle.revocations.push(revocation)

    const profile = await verifyGovernedCustodyBundle(bundle, subjects)
    expect(profile.custody_ready).toBe(false)
    expect(profile.revocation_results[0]?.accepted).toBe(true)
    expect(profile.envelope_results[0]).toMatchObject({ revoked: true, accepted: false })
  })

  it('rejects a revocation signed by an unrelated authority without scope', async () => {
    const issuer = await generateLocalSigner('Issuer', [], '2026-07-23T00:00:00Z')
    const outsider = await generateLocalSigner('Outsider', [], '2026-07-23T00:00:00Z')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, issuer, { signed_at_utc: '2026-07-23T00:01:00Z' })
    const revocation = await revokeEvidence(envelope.evidence_id, outsider, 'Unauthorized withdrawal.', { issued_at_utc: '2026-07-23T00:02:00Z' })
    const bundle = bundleWithSigner(issuer.identity)
    bundle.signers.push(outsider.identity)
    bundle.envelopes.push(envelope)
    bundle.revocations.push(revocation)

    const profile = await verifyGovernedCustodyBundle(bundle, subjects)
    expect(profile.revocation_results[0]?.accepted).toBe(false)
    expect(profile.revocation_results[0]?.issues.some((item) => item.code === 'REVOCATION_NOT_AUTHORIZED')).toBe(true)
    expect(profile.envelope_results[0]?.accepted).toBe(true)
  })

  it('rejects evidence from a signer marked revoked', async () => {
    const signer = await generateLocalSigner('Inactive signer test', [], '2026-07-23T00:00:00Z')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, { signed_at_utc: '2026-07-23T00:01:00Z' })
    const inactiveIdentity = { ...signer.identity, status: 'revoked' as const }
    const bundle = bundleWithSigner(inactiveIdentity)
    bundle.envelopes.push(envelope)

    const profile = await verifyGovernedCustodyBundle(bundle, subjects)
    expect(profile.custody_ready).toBe(false)
    expect(profile.envelope_results[0]?.signer_active).toBe(false)
    expect(profile.envelope_results[0]?.issues.some((item) => item.code === 'SIGNER_IDENTITY_REJECTED')).toBe(true)
  })

  it('rejects a signer id detached from its public-key fingerprint', async () => {
    const signer = await generateLocalSigner('Fingerprint test', [], '2026-07-23T00:00:00Z')
    const envelope = await signEvidenceSubject(suite, 'contract-conformance-suite', locator, signer, { signed_at_utc: '2026-07-23T00:01:00Z' })
    const detachedIdentity = { ...signer.identity, id: `signer:${'0'.repeat(64)}` }
    const detachedEnvelope = { ...envelope, signer_id: detachedIdentity.id }
    const bundle = bundleWithSigner(detachedIdentity)
    bundle.envelopes.push(detachedEnvelope)

    const profile = await verifyGovernedCustodyBundle(bundle, subjects)
    expect(profile.custody_ready).toBe(false)
    expect(profile.signer_results[0]?.fingerprint_valid).toBe(false)
    expect(profile.signer_results[0]?.issues.some((item) => item.code === 'SIGNER_FINGERPRINT_MISMATCH')).toBe(true)
  })
})

describe('custody bundle import and public boundary', () => {
  it('validates an empty planning bundle and parses exported JSON', () => {
    const bundle = emptyCustodyBundle()
    expect(validateCustodyBundle(bundle)).toEqual([])
    const parsed = parseCustodyBundleJson(JSON.stringify(bundle))
    expect(parsed.issues).toEqual([])
    expect(parsed.bundle?.bundle_schema_version).toBe('evidence-custody-bundle:v0.1')
  })

  it('rejects malformed bundle structure', () => {
    const parsed = parseCustodyBundleJson('{"bundle_schema_version":"wrong"}')
    expect(parsed.bundle).toBeNull()
    expect(parsed.issues.length).toBeGreaterThan(0)
  })

  it('contains no private research identifiers', () => {
    const publicSurface = JSON.stringify({ suite, module: 'Evidence Custody', schema: emptyCustodyBundle() }).toLowerCase()
    expect(publicSurface).not.toContain('saasy')
    expect(publicSurface).not.toContain('reduced-hamiltonian')
  })
})
