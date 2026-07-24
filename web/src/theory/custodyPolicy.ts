import {
  sha256EvidenceDigest,
  verifyCustodyBundle,
  type CustodyProfile,
  type CustodyValidationIssue,
  type EvidenceCustodyBundle,
  type EvidenceSignerIdentity,
  type EnvelopeVerification,
  type RevocationVerification,
} from './custody.js'

export interface SignerIdentityVerification {
  signer_id: string
  fingerprint_valid: boolean
  status_active: boolean
  accepted: boolean
  issues: CustodyValidationIssue[]
}

export interface GovernedCustodyProfile extends CustodyProfile {
  signer_results: SignerIdentityVerification[]
}

function notice(path: string, code: string, message: string): CustodyValidationIssue {
  return { path, code, message }
}

async function verifySignerIdentity(identity: EvidenceSignerIdentity): Promise<SignerIdentityVerification> {
  const digest = await sha256EvidenceDigest(identity.public_key_jwk)
  const expectedId = `signer:${digest.slice('sha256:'.length)}`
  const fingerprintValid = identity.id === expectedId
  const statusActive = identity.status === 'active'
  const issues: CustodyValidationIssue[] = []
  if (!fingerprintValid) issues.push(notice(identity.id, 'SIGNER_FINGERPRINT_MISMATCH', 'Signer id does not match the SHA-256 fingerprint of its public JWK.'))
  if (!statusActive) issues.push(notice(identity.id, 'INACTIVE_SIGNER', 'Signer identity is not active.'))
  return { signer_id: identity.id, fingerprint_valid: fingerprintValid, status_active: statusActive, accepted: fingerprintValid && statusActive, issues }
}

export async function verifyGovernedCustodyBundle(
  bundle: EvidenceCustodyBundle,
  subjects: Record<string, unknown>,
): Promise<GovernedCustodyProfile> {
  const base = await verifyCustodyBundle(bundle, subjects)
  const signerResults = await Promise.all(bundle.signers.map(verifySignerIdentity))
  const signerResultById = new Map(signerResults.map((result) => [result.signer_id, result]))
  const signerById = new Map(bundle.signers.map((identity) => [identity.id, identity]))
  const envelopeById = new Map(bundle.envelopes.map((envelope) => [envelope.evidence_id, envelope]))

  const revocationResults: RevocationVerification[] = base.revocation_results.map((result) => {
    const record = bundle.revocations.find((item) => item.revocation_id === result.revocation_id)
    const target = envelopeById.get(result.target_evidence_id)
    const authority = signerById.get(result.authority_id)
    const identityAccepted = signerResultById.get(result.authority_id)?.accepted === true
    const authorityPermitted = Boolean(
      target && authority &&
      (target.signer_id === result.authority_id || authority.authority_scope.includes('revoke:any-evidence')),
    )
    const issues = [...result.issues]
    if (!identityAccepted) issues.push(notice(result.revocation_id, 'AUTHORITY_IDENTITY_REJECTED', 'Revocation authority failed signer identity verification.'))
    if (!target) issues.push(notice(result.revocation_id, 'UNKNOWN_REVOCATION_TARGET', 'Revocation target evidence is not present in this custody bundle.'))
    if (record && !authorityPermitted) issues.push(notice(result.revocation_id, 'REVOCATION_NOT_AUTHORIZED', 'Authority may revoke only its own issued evidence unless revoke:any-evidence is explicitly declared.'))
    return {
      ...result,
      authority_active: result.authority_active && identityAccepted,
      accepted: result.accepted && identityAccepted && authorityPermitted,
      issues,
    }
  })

  const authorizedRevokedIds = new Set(revocationResults.filter((result) => result.accepted).map((result) => result.target_evidence_id))
  const cryptographicallyEligibleIds = new Set<string>()
  for (const result of base.envelope_results) {
    if (
      result.digest_valid && result.evidence_id_valid && result.signature_valid && result.signer_known &&
      signerResultById.get(result.signer_id)?.accepted === true && !authorizedRevokedIds.has(result.evidence_id)
    ) {
      cryptographicallyEligibleIds.add(result.evidence_id)
    }
  }

  const supersededIds = new Set<string>()
  for (const envelope of bundle.envelopes) {
    if (!cryptographicallyEligibleIds.has(envelope.evidence_id)) continue
    for (const prior of envelope.supersedes) {
      if (cryptographicallyEligibleIds.has(prior)) supersededIds.add(prior)
    }
  }

  const envelopeResults: EnvelopeVerification[] = base.envelope_results.map((result) => {
    const identityAccepted = signerResultById.get(result.signer_id)?.accepted === true
    const revoked = authorizedRevokedIds.has(result.evidence_id)
    const superseded = supersededIds.has(result.evidence_id)
    const accepted = Boolean(
      result.digest_valid && result.evidence_id_valid && result.signature_valid && result.signer_known &&
      identityAccepted && !revoked && !superseded,
    )
    const issues = result.issues.filter((item) => !['REVOKED', 'SUPERSEDED'].includes(item.code))
    if (!identityAccepted) issues.push(notice(result.evidence_id, 'SIGNER_IDENTITY_REJECTED', 'Signer fingerprint or status failed governed identity verification.'))
    if (revoked) issues.push(notice(result.evidence_id, 'REVOKED', 'A valid and authorized revocation targets this evidence.'))
    if (superseded) issues.push(notice(result.evidence_id, 'SUPERSEDED', 'A newer valid envelope supersedes this evidence.'))
    return { ...result, signer_active: result.signer_active && identityAccepted, revoked, superseded, accepted, issues }
  })

  const activeEnvelopes = envelopeResults.filter((result) => result.accepted)
  const issues = [
    ...base.issues.filter((item) => !['REVOKED', 'SUPERSEDED'].includes(item.code)),
    ...signerResults.flatMap((result) => result.issues),
    ...revocationResults.flatMap((result) => result.issues.filter((item) => !base.issues.includes(item))),
    ...envelopeResults.flatMap((result) => result.issues.filter((item) => !base.issues.includes(item))),
  ]

  return {
    ...base,
    accepted_evidence_ids: activeEnvelopes.map((result) => result.evidence_id),
    active_envelopes: activeEnvelopes,
    envelope_results: envelopeResults,
    revocation_results: revocationResults,
    signer_results: signerResults,
    issues,
    custody_ready: base.bundle_valid && activeEnvelopes.length > 0,
  }
}
