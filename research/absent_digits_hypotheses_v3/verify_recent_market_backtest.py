"""Fast integrity checks for the recent market-specific backtest."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
RESULTS = HERE / "RECENT_MARKET_BACKTEST.json"
MATRIX = HERE / "event_candidate_matrix.npz"


def main() -> None:
    payload = json.loads(RESULTS.read_text(encoding="utf-8"))
    matrix = np.load(MATRIX)
    assert payload["latestActualDate"] == "2026-07-23"
    assert payload["candidateModelsCompared"] >= 100
    assert payload["decision"]["productionChanged"] is True
    assert payload["decision"]["promotedModelId"] == (
        "absent-digits-guarded-market-routing-v3"
    )
    assert payload["windows"]["last30"]["events"] == 610
    assert payload["windows"]["last180"]["events"] == 3636
    assert len(payload["dailyActualComparisonLast30"]) == 610
    assert len(payload["routeResults"]) == 24
    assert len(payload["marketResults"]) == 12
    assert matrix["candidate_hits"].shape == matrix["candidate_applicable"].shape
    assert matrix["candidate_hits"].shape[0] == len(matrix["candidate_names"])
    for row in payload["dailyActualComparisonLast30"]:
        assert len(row["actualPanel"]) == 3
        assert len(row["actualAbsentDigits"]) >= 7
        assert row["actualCompared"] is True
    for strategy in payload["strategies"].values():
        assert strategy["last30"]["n"] == 610
        assert strategy["last180"]["n"] == 3636
    for route in payload["routeResults"].values():
        assert 0 <= route["staticLast180FdrQValueAcrossRoutes"] <= 1
    assert payload["multiplicityConfirmedRouteTweaks"] == []
    print(json.dumps({
        "status": "verified",
        "models": payload["candidateModelsCompared"],
        "events30": payload["windows"]["last30"]["events"],
        "events180": payload["windows"]["last180"]["events"],
        "productionChanged": True,
    }, indent=2))


if __name__ == "__main__":
    main()
