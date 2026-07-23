import pytest

from langarian.claims import Claim
from langarian.epistemic import EpistemicTag, ResultStatus
from langarian.proof_gate import (
    ProofGateError,
    evaluate_claims,
    promote_model_assumption,
    require_proof_eligible,
)


def test_proof_gate_allows_formal_and_computed_claims():
    claims = [
        Claim("Coherence is bounded by contract.", EpistemicTag.FORMAL),
        Claim("Similarity was computed by the kernel.", EpistemicTag.COMPUTED),
    ]
    report = require_proof_eligible(claims)
    assert report.status == ResultStatus.PASS
    assert len(report.allowed) == 2
    assert len(report.blocked) == 0


def test_proof_gate_blocks_interpretive_metaphor_observed_and_model_claims():
    claims = [
        Claim("This feels luminous.", EpistemicTag.METAPHOR),
        Claim("This maps to an emotional domain.", EpistemicTag.INTERPRETIVE),
        Claim("A user observed resonance.", EpistemicTag.OBSERVED),
        Claim("Assume a domain embedding.", EpistemicTag.MODEL),
    ]
    report = evaluate_claims(claims)
    assert report.status == ResultStatus.FAIL
    assert len(report.blocked) == 4
    with pytest.raises(ProofGateError):
        require_proof_eligible(claims, context="unit-test")


def test_model_claim_can_be_promoted_only_with_explicit_assumption_record():
    claim = Claim("Emotional states are represented by a 2D basis for this demo.", EpistemicTag.MODEL)
    promoted = promote_model_assumption(
        claim,
        assumption_id="A-demo-emotion-2d",
        justification="Bounded demonstration setup, not a psychology claim.",
    )
    assert promoted.tag == EpistemicTag.COMPUTED
    assert promoted.metadata["promoted_from"] == "MODEL"
    # v0.3: a MODEL-promoted claim is NOT proof-eligible on promotion alone;
    # it requires an explicit formal_derivation_id (SPEC section 3.7).
    with pytest.raises(ProofGateError):
        require_proof_eligible([promoted])


def test_promoted_model_claim_with_formal_derivation_is_proof_eligible():
    claim = Claim("A bounded model statement.", EpistemicTag.MODEL)
    promoted = promote_model_assumption(claim, assumption_id="A-1", justification="Recorded assumption.")
    derived = Claim(
        text=promoted.text,
        tag=promoted.tag,
        evidence=promoted.evidence,
        metadata={**promoted.metadata, "formal_derivation_id": "derivation-123"},
    )
    report = require_proof_eligible([derived])
    assert report.status == ResultStatus.PASS
    assert len(report.allowed) == 1


def test_non_model_claim_cannot_be_promoted_as_model_assumption():
    claim = Claim("Poetic description.", EpistemicTag.METAPHOR)
    with pytest.raises(ProofGateError):
        promote_model_assumption(claim, assumption_id="bad", justification="not allowed")
