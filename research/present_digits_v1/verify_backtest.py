"""Integrity checks for the frozen two-digit-present research output."""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent


def main() -> None:
    payload = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    assert payload["strictTarget"] == "both selected digits occur in the same panel"
    assert payload["windows"]["last30"]["events"] >= 500
    assert payload["windows"]["last180"]["events"] >= 3000
    assert payload["decision"]["selectedModel"] == "joint_180"
    assert payload["decision"]["targetReached"] is False
    assert payload["decision"]["borrowedSignalsKept"] == []
    assert payload["decision"]["marketSpecificRoutesPromoted"] == []
    assert payload["decision"]["routingConfirmed"] is False
    assert "jodi_transition" in payload["candidateModels"]
    assert "avoid_appearance_marginal" in payload["candidateModels"]
    assert "sp_dp_conditioned" in payload["candidateModels"]
    for window in ("last30", "last180"):
        result = payload["comparisons"][window]["joint_180"]
        assert result["events"] == payload["windows"][window]["events"]
        assert result["accuracy"] == result["hits"] / result["events"]
        assert result["accuracy"] < payload["targetAccuracy"]
    assert (HERE / "REPORT.md").exists()
    print(
        json.dumps(
            {
                "verified": True,
                "latest": payload["latestActualDate"],
                "events180": payload["windows"]["last180"]["events"],
            }
        )
    )


if __name__ == "__main__":
    main()
