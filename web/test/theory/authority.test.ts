import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROMOTION_AUTHORITY_POLICY,
  emptyAuthorityBundle,
  filePromotionAppeal,
  generateLocalAuthority,
  issuePromotionMandate,
  signPromotionBallot,
  signRollbackBallot,
  validateAuthorityBundle,
  type LocalAuthoritySession,
  type PromotionAuthorityBundle,
  type PromotionMandate,
} from '../../src/theory/authority.js'
import { buildRenewalAwarePromotionAuthorityProfile } from '../../src/theory/authorityGovernance.js'
import {
  createSignedPromotionDecision,
  evaluateSignedDecisionLifecycle,
  verifySignedPromotionDecision,
} from '../../src/theory/signedDecision.js'
import type { PromotionAssessmentReceipt } from '../../src/theory/promotion.js'

const T0 = '2026-07-24T00:00:00.000Z'
const T1 = '2026-07-24T00:01:00.000Z'
const T2 = '2026-07-24T00:02:00.000Z'

function assessment(status: 'ELIGIBLE_FOR_REVIEW' | 'BLOCKED' = 'ELIGIBLE_FOR_REVIEW'): PromotionAssessmentReceipt {
  return {
    schema_version: 'promotion-assessment:v0.1',
    assessment_id: `assessment:${status.toLowerCase()}`,
    assessment_type: 'eligibility-review-not-package-mutation',
    package: { id: 'example-package', version: '1.0.0', current_maturity_level: 3, target_level: 4 },
    policy: { id: 'test-promotion-policy', version: '0.1.0', schema_version: 'promotion-policy:v0.1' },
    evidence: {
      suite_locator: 'conformance-suite:example-package@1.0.0',
      suite_digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      admissible_evidence_ids: ['evidence:test'],
      distinct_signer_ids: ['signer:test'],
    },
    conformance: { suite_schema_version: 'contract-conformance-suite:v0.1', promotion_eligible: status === 'ELIGIBLE_FOR_REVIEW', operator_count: 1, blockers: status === 'BLOCKED' ? ['Missing falsifier evidence.'] : [] },
    custody: { bundle_valid: true, custody_ready: true, admissible_evidence_count: 1, lifecycle_issue_count: 0 },
    status,
    blockers: status === 'BLOCKED' ? ['Contract conformance has not earned Level-4 eligibility.'] : [],
    warnings: [],
    issued_at_utc: T0,
    claims_supported: status === 'ELIGIBLE_FOR_REVIEW' ? ['May enter governance review.'] : ['Remains blocked.'],
    prohibited_inferences: ['No automatic package mutation.'],
  }
}

interface Council {
  issuer: LocalAuthoritySession
  mathematical: LocalAuthoritySession
  implementation: LocalAuthoritySession
  mathMandate: PromotionMandate
  implementationMandate: PromotionMandate
  bundle: PromotionAuthorityBundle
}

async function council(
  receipt: PromotionAssessmentReceipt,
  options: {
    mathDomain?: string
    implementationDomain?: string
    expiresAt?: string
    includeBallots?: boolean
  } = {},
): Promise<Council> {
  const issuer = await generateLocalAuthority(
    'Issuer and recorder',
    ['mandate-issuer', 'decision-recorder'],
    ['governance-office'],
    ['issue:promotion-mandate', 'record:promotion-decision', 'appeal:promotion-decision'],
    T0,
  )
  const mathematical = await generateLocalAuthority(
    'Mathematical reviewer',
    ['mathematical-review'],
    [options.mathDomain ?? 'mathematical-analysis'],
    ['vote:promotion-level4', 'appeal:promotion-decision', 'rollback:promotion-decision'],
    T0,
  )
  const implementation = await generateLocalAuthority(
    'Implementation auditor',
    ['implementation-audit'],
    [options.implementationDomain ?? 'runtime-conformance'],
    ['vote:promotion-level4', 'appeal:promotion-decision', 'rollback:promotion-decision'],
    T0,
  )
  const mandateOptions = {
    valid_from_utc: T0,
    expires_at_utc: options.expiresAt ?? '2026-08-23T00:00:00.000Z',
    issued_at_utc: T0,
    max_decisions: 1,
  }
  const mathMandate = await issuePromotionMandate(
    issuer,
    mathematical.identity.id,
    'mathematical-review',
    receipt,
    ['vote:promotion-level4', 'rollback:promotion-decision'],
    mandateOptions,
  )
  const implementationMandate = await issuePromotionMandate(
    issuer,
    implementation.identity.id,
    'implementation-audit',
    receipt,
    ['vote:promotion-level4', 'rollback:promotion-decision'],
    mandateOptions,
  )
  const ballots = options.includeBallots === false ? [] : [
    await signPromotionBallot(mathematical, receipt, mathMandate, 'APPROVE', 'Mathematical approval.', { issued_at_utc: T1 }),
    await signPromotionBallot(implementation, receipt, implementationMandate, 'APPROVE', 'Implementation approval.', { issued_at_utc: T1 }),
  ]
  return {
    issuer,
    mathematical,
    implementation,
    mathMandate,
    implementationMandate,
    bundle: {
      ...emptyAuthorityBundle(),
      authorities: [issuer.identity, mathematical.identity, implementation.identity],
      mandates: [mathMandate, implementationMandate],
      ballots,
      metadata: { test_fixture: true },
    },
  }
}

describe('promotion authority quorum', () => {
  it('authorizes an eligible assessment with signed mandates, required roles, and independent domains', async () => {
    const receipt = assessment()
    const built = await council(receipt)
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)

    expect(profile.status).toBe('APPROVED_PENDING_PACKAGE_UPDATE')
    expect(profile.quorum_satisfied).toBe(true)
    expect(profile.accepted_approvals).toHaveLength(2)
    expect(profile.distinct_independence_domains.sort()).toEqual(['mathematical-analysis', 'runtime-conformance'])
    expect(profile.covered_roles.sort()).toEqual(['implementation-audit', 'mathematical-review'])

    const decision = await createSignedPromotionDecision(profile, 3, built.issuer, T2)
    const verification = await verifySignedPromotionDecision(decision, built.bundle.authorities, T2)
    expect(verification.accepted).toBe(true)
    expect(decision.status).toBe('APPROVED_PENDING_PACKAGE_UPDATE')
    expect(decision.prohibited_inferences.join(' ')).toMatch(/automatically changed/)
  })

  it('cannot authorize a blocked prerequisite even with unanimous valid ballots', async () => {
    const receipt = assessment('BLOCKED')
    const built = await council(receipt)
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)

    expect(profile.accepted_approvals).toHaveLength(2)
    expect(profile.status).toBe('BLOCKED')
    expect(profile.blockers.some((item) => item.includes('not ELIGIBLE_FOR_REVIEW'))).toBe(true)
  })

  it('requires declared independence-domain diversity', async () => {
    const receipt = assessment()
    const built = await council(receipt, { mathDomain: 'shared-domain', implementationDomain: 'shared-domain' })
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)

    expect(profile.status).toBe('BLOCKED')
    expect(profile.blockers.some((item) => item.includes('independence domain'))).toBe(true)
  })

  it('rejects expired mandates', async () => {
    const receipt = assessment()
    const built = await council(receipt, { expiresAt: '2026-07-23T23:59:00.000Z' })
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)

    expect(profile.status).toBe('BLOCKED')
    expect(profile.mandates.every((item) => item.time_valid === false)).toBe(true)
  })

  it('blocks when a valid rejection accompanies an otherwise sufficient approval quorum', async () => {
    const receipt = assessment()
    const built = await council(receipt)
    const dissenter = await generateLocalAuthority(
      'Protected dissenter',
      ['mathematical-review'],
      ['independent-red-team'],
      ['vote:promotion-level4'],
      T0,
    )
    const dissentMandate = await issuePromotionMandate(
      built.issuer,
      dissenter.identity.id,
      'mathematical-review',
      receipt,
      ['vote:promotion-level4'],
      { valid_from_utc: T0, expires_at_utc: '2026-08-23T00:00:00.000Z', issued_at_utc: T0, max_decisions: 1 },
    )
    const rejection = await signPromotionBallot(dissenter, receipt, dissentMandate, 'REJECT', 'Unresolved objection.', { issued_at_utc: T1 })
    const bundle = {
      ...built.bundle,
      authorities: [...built.bundle.authorities, dissenter.identity],
      mandates: [...built.bundle.mandates, dissentMandate],
      ballots: [...built.bundle.ballots, rejection],
    }
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)

    expect(profile.accepted_approvals).toHaveLength(2)
    expect(profile.accepted_rejections).toHaveLength(1)
    expect(profile.status).toBe('REJECTED')
  })
})

describe('mandate and decision lifecycle', () => {
  it('renews mandates append-only without allowing superseded history to block current quorum', async () => {
    const receipt = assessment()
    const built = await council(receipt, { includeBallots: false, expiresAt: '2026-07-10T00:00:00.000Z' })
    const renewalOptions = {
      valid_from_utc: '2026-07-10T00:00:00.000Z',
      expires_at_utc: '2026-08-10T00:00:00.000Z',
      issued_at_utc: '2026-07-09T00:00:00.000Z',
      max_decisions: 1,
    }
    const renewedMath = await issuePromotionMandate(
      built.issuer,
      built.mathematical.identity.id,
      'mathematical-review',
      receipt,
      ['vote:promotion-level4', 'rollback:promotion-decision'],
      { ...renewalOptions, supersedes: [built.mathMandate.mandate_id] },
    )
    const renewedImplementation = await issuePromotionMandate(
      built.issuer,
      built.implementation.identity.id,
      'implementation-audit',
      receipt,
      ['vote:promotion-level4', 'rollback:promotion-decision'],
      { ...renewalOptions, supersedes: [built.implementationMandate.mandate_id] },
    )
    const mathBallot = await signPromotionBallot(built.mathematical, receipt, renewedMath, 'APPROVE', 'Renewed approval.', { issued_at_utc: '2026-07-15T00:01:00.000Z' })
    const implementationBallot = await signPromotionBallot(built.implementation, receipt, renewedImplementation, 'APPROVE', 'Renewed approval.', { issued_at_utc: '2026-07-15T00:01:00.000Z' })
    const bundle = {
      ...built.bundle,
      mandates: [...built.bundle.mandates, renewedMath, renewedImplementation],
      ballots: [mathBallot, implementationBallot],
    }
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, '2026-07-15T00:02:00.000Z')

    expect(profile.mandates.filter((item) => item.superseded)).toHaveLength(2)
    expect(profile.status).toBe('APPROVED_PENDING_PACKAGE_UPDATE')
  })

  it('creates deterministic signed decision ids for a fixed body and recorder', async () => {
    const receipt = assessment()
    const built = await council(receipt)
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)
    const first = await createSignedPromotionDecision(profile, 3, built.issuer, T2)
    const second = await createSignedPromotionDecision(profile, 3, built.issuer, T2)

    expect(first.decision_id).toBe(second.decision_id)
    expect(first.signature).toBe(second.signature)
  })

  it('opens an appeal without rewriting or automatically reversing the signed decision', async () => {
    const receipt = assessment()
    const built = await council(receipt)
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)
    const decision = await createSignedPromotionDecision(profile, 3, built.issuer, T2)
    const appeal = await filePromotionAppeal(built.mathematical, decision, 'Request re-review.', { issued_at_utc: '2026-07-24T00:03:00.000Z' })
    const bundle = { ...built.bundle, appeals: [appeal] }
    const lifecycle = await evaluateSignedDecisionLifecycle(decision, bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, '2026-07-24T00:04:00.000Z')

    expect(lifecycle.appeal.appeal_open).toBe(true)
    expect(lifecycle.operative).toBe(false)
    expect(decision.status).toBe('APPROVED_PENDING_PACKAGE_UPDATE')
  })

  it('expires a signed decision without deleting its receipt', async () => {
    const receipt = assessment()
    const built = await council(receipt)
    const shortPolicy = { ...DEFAULT_PROMOTION_AUTHORITY_POLICY, decision_validity_days: 1 }
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, shortPolicy, T2)
    const decision = await createSignedPromotionDecision(profile, 3, built.issuer, T2)
    const lifecycle = await evaluateSignedDecisionLifecycle(decision, built.bundle, shortPolicy, '2026-07-26T00:02:00.000Z')

    expect(lifecycle.expired).toBe(true)
    expect(lifecycle.operative).toBe(false)
    expect(lifecycle.verification.accepted).toBe(false)
  })

  it('requires independent rollback quorum under verified active mandates', async () => {
    const receipt = assessment()
    const built = await council(receipt)
    const profile = await buildRenewalAwarePromotionAuthorityProfile(receipt, built.bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, T2)
    const decision = await createSignedPromotionDecision(profile, 3, built.issuer, T2)
    const mathRollback = await signRollbackBallot(built.mathematical, decision, built.mathMandate, 'Rollback after discovered defect.', { issued_at_utc: '2026-07-24T00:03:00.000Z' })
    const implementationRollback = await signRollbackBallot(built.implementation, decision, built.implementationMandate, 'Rollback after reproducible defect.', { issued_at_utc: '2026-07-24T00:03:00.000Z' })
    const bundle = { ...built.bundle, rollback_ballots: [mathRollback, implementationRollback] }
    const lifecycle = await evaluateSignedDecisionLifecycle(decision, bundle, DEFAULT_PROMOTION_AUTHORITY_POLICY, '2026-07-24T00:04:00.000Z')

    expect(lifecycle.rollback.status).toBe('ROLLBACK_AUTHORIZED_PENDING_PACKAGE_UPDATE')
    expect(lifecycle.rollback.valid_ballot_ids).toHaveLength(2)
    expect(lifecycle.operative).toBe(false)
  })
})

describe('public authority boundary', () => {
  it('validates an empty authority bundle and contains no private research identifiers', () => {
    const bundle = emptyAuthorityBundle()
    expect(validateAuthorityBundle(bundle)).toEqual([])
    const publicSurface = JSON.stringify({ bundle, policy: DEFAULT_PROMOTION_AUTHORITY_POLICY }).toLowerCase()
    expect(publicSurface).not.toContain('saasy')
    expect(publicSurface).not.toContain('reduced-hamiltonian')
  })
})
