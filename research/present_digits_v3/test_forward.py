"""Check the frozen call registry and prospective scoring behavior."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

import forward


class ForwardTests(unittest.TestCase):
    def test_registry_reproduces_frozen_pairs_and_matches_study(self) -> None:
        markets, _ = forward.study.previous.load_rows()
        fresh = forward.freeze(markets)
        registry = json.loads(forward.REGISTRY.read_text(encoding="utf-8"))
        self.assertEqual(registry["studyResultsSHA256"], forward.study.text_sha256(forward.study.HERE / "results.json"))
        for key, value in fresh.items():
            self.assertEqual(value, registry[key])
        self.assertEqual(len(registry["calls"]), 24)
        # A dummy future outcome must not influence the research forecast.
        extended = copy.deepcopy(markets)
        for market, rows in extended.items():
            rows.append({"date": "2026-10-18", "market": market, "open": "123", "close": "456"})
        data = forward.study.build_dataset(extended)
        indices = np.flatnonzero(data.dates == "2026-10-18")
        for call in registry["calls"]:
            index = next(index for index in indices if data.routes[index] == f"{call['market']}|{call['side']}")
            score = 0.25 * data.baseline[index] + 0.75 * data.pooled[index, 1]
            self.assertEqual(list(forward.study.PAIRS[int(score.argmax())]), call["candidatePair"])
            self.assertEqual(list(forward.study.PAIRS[int(data.baseline[index].argmax())]), call["baselinePair"])

    def test_scoring_is_strict_and_uses_earliest_future_row_without_mutation(self) -> None:
        registry = {"model": forward.MODEL, "status": "RESEARCH_ONLY", "observedThrough": "2026-10-17",
                    "calls": [{"market": "A", "side": "open", "candidatePair": [1, 2], "baselinePair": [3, 4]},
                              {"market": "B", "side": "close", "candidatePair": [0, 9], "baselinePair": [7, 8]}]}
        before = copy.deepcopy(registry)
        rows = {"A": [{"date": "2026-10-20", "open": "345"},
                       {"date": "2026-10-18", "open": "119"},
                       {"date": "2026-10-17", "open": "123"}]}
        result = forward.score(registry, rows)
        self.assertEqual(result["scored"], 1)
        self.assertEqual(result["pending"], 1)
        self.assertEqual(result["candidateHits"], 0)
        self.assertEqual(result["baselineHits"], 0)
        self.assertEqual(result["calls"][0]["date"], "2026-10-18")
        self.assertEqual(registry, before)

    def test_csv_rejects_conflicting_or_invalid_results(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rows.csv"
            for contents in ("date,market,open,close\n2026-10-18,A,12x,456\n",
                             "date,market,open,close\n2026-10-18,A,123,456\n2026-10-18,A,124,456\n",
                             "market,open,close\nA,123,456\n"):
                path.write_text(contents, encoding="utf-8")
                with self.assertRaises(ValueError):
                    forward.load_csv([path])


if __name__ == "__main__":
    unittest.main()
