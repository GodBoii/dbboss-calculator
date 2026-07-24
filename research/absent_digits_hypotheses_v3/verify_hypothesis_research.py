"""Fast artifact and promotion-invariant checks for the V3 hypothesis study."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RESULTS = HERE / "results.json"
REPORT = HERE / "REPORT.md"
BASELINE = ROOT / "research" / "absent_digits_v2" / "run_research.py"
REQUIRED_BLOCKS = {
    "validation", "holdout", "recent", "post_cache", "independent_extension"
}
REQUIRED_CATEGORIES = {
    "previous_result", "previous_prediction", "sutta_jodi", "cross_market",
    "day_to_night", "opposite_rotation", "groups_houses", "learned_family",
    "frequency", "balance", "streak_pressure", "calendar", "position",
    "interaction", "automatic_discovery", "open_to_close",
}


def main() -> None:
    payload = json.loads(RESULTS.read_text(encoding="utf-8"))
    results = payload["results"]
    assert payload["hypothesesTested"] == len(results) >= 100
    assert payload["productionChanged"] is False
    assert payload["baseline"]["appearanceBlendWeight"] == 0.75
    assert payload["hashes"]["baselineCodeSha256"] == hashlib.sha256(
        BASELINE.read_bytes()
    ).hexdigest()
    assert REQUIRED_CATEGORIES <= {row["category"] for row in results.values()}
    assert "hmm_three_state_sutta" in results
    assert "learned_digit_family" in results
    assert "auto_warmup_cross_source_selector" in results

    keep_rows = []
    for name, row in results.items():
        assert REQUIRED_BLOCKS == set(row["blocks"])
        assert row["verdict"] in {
            "REJECT", "KEEP_FOR_PROSPECTIVE", "RESEARCH_ONLY_CONDITIONAL"
        }
        assert 0 <= row["confirmationFdrQValue"] <= 1
        assert row["computationalCost"] in {"low", "medium", "high"}
        assert row["overfitRisk"] in {"low", "medium", "high"}
        for block in row["blocks"].values():
            assert block["n"] >= 0
            if block["n"]:
                assert 0 <= block["accuracy"] <= 1
                assert 0 <= block["standaloneAccuracy"] <= 1
                assert len(block["wilson95"]) == 2
        if row["verdict"] == "KEEP_FOR_PROSPECTIVE":
            assert row["contract"] == "pre_open"
            assert all(row["gates"].values())
            keep_rows.append(name)
        if row["contract"] == "post_open_close":
            assert row["verdict"] == "RESEARCH_ONLY_CONDITIONAL"

    assert keep_rows == payload["keptForProspective"]
    report = REPORT.read_text(encoding="utf-8")
    assert f"Tested **{len(results)}** named hypotheses" in report
    assert "production runtime was not changed" in report
    print(json.dumps({
        "status": "verified",
        "hypotheses": len(results),
        "keptForProspective": keep_rows,
        "productionChanged": payload["productionChanged"],
    }, indent=2))


if __name__ == "__main__":
    main()
