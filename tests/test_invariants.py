from langarian.claims import Claim
from langarian.epistemic import EpistemicTag
from langarian.contracts import interpretation_quarantine
from langarian.epistemic import ResultStatus


def test_interpretive_claim_cannot_be_used_as_proof():
    claim = Claim("This feels like a luminous upward turn.", EpistemicTag.METAPHOR)
    assert not claim.can_be_used_as_proof()


def test_formal_claim_can_be_used_as_proof():
    claim = Claim("Coherence is bounded in [0, 1].", EpistemicTag.FORMAL)
    assert claim.can_be_used_as_proof()


def test_interpretation_quarantine_warns():
    result = interpretation_quarantine([EpistemicTag.METAPHOR.value])
    assert result.status == ResultStatus.WARN
