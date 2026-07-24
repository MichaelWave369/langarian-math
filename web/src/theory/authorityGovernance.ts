import {
  buildPromotionAuthorityProfile,
  type AuthorityDecisionStatus,
  type PromotionAuthorityBundle,
  type PromotionAuthorityPolicy,
  type PromotionAuthorityProfile,
} from './authority.js'
import type { PromotionAssessmentReceipt } from './promotion.js'

/**
 * Build the authority profile while preserving superseded mandates as history
 * rather than treating them as current blockers. A superseded record remains
 * inspectable and non-operative; only a current invalid mandate blocks quorum.
 */
export async function buildRenewalAwarePromotionAuthorityProfile(
  assessment: PromotionAssessmentReceipt,
  bundle: PromotionAuthorityBundle,
  policy: PromotionAuthorityPolicy,
  now = new Date().toISOString(),
): Promise<PromotionAuthorityProfile> {
  const profile = await buildPromotionAuthorityProfile(assessment, bundle, policy, now)
  const historicalMandateIds = new Set(profile.mandates.filter((item) => item.superseded).map((item) => item.mandate_id))
  const blockers = profile.blockers.filter((blocker) => ![...historicalMandateIds].some((id) => blocker.startsWith(`${id}:`)))
  const quorumSatisfied = blockers.length === 0
  const status: AuthorityDecisionStatus = !profile.assessment_eligible || profile.accepted_approvals.length < policy.minimum_approvals
    ? 'BLOCKED'
    : profile.accepted_rejections.length > 0 && policy.require_no_reject_ballots
      ? 'REJECTED'
      : quorumSatisfied
        ? 'APPROVED_PENDING_PACKAGE_UPDATE'
        : 'BLOCKED'
  return { ...profile, blockers, quorum_satisfied: quorumSatisfied, status }
}
