"""Leakage, ablation, frozen-artifact and 90% abstention checks."""
from __future__ import annotations

import gzip
import json
import unittest

import numpy as np
from scipy.special import expit, logit

import evaluate as E


class FeatureSafety(unittest.TestCase):
    def test_current_and_future_close_do_not_enter_current_feature(self) -> None:
        rows = [
            {"date": "2025-01-02", "market": "Sridevi", "open": "112", "close": "123"},
            {"date": "2025-01-03", "market": "Sridevi", "open": "112", "close": "112"},
            {"date": "2025-01-06", "market": "Sridevi", "open": "112", "close": "112"},
        ]
        original = E.study_features(rows)
        poisoned = E.study_features([rows[0], {**rows[1], "close": "999"}, {**rows[2], "close": "123"}])
        key = ("2025-01-03", "Sridevi")
        self.assertEqual(original[key], poisoned[key])
        self.assertEqual(original[key]["priorSupport"], 1)
        self.assertAlmostEqual(original[key]["conditional"], 1 / 3)

    def test_weekend_missing_open_and_tp(self) -> None:
        weekday = {"date": "2025-01-03", "market": "Sridevi", "open": "111", "close": "112"}
        weekend = {"date": "2025-01-04", "market": "Sridevi", "open": "123", "close": "123"}
        target = {"date": "2025-01-06", "market": "Sridevi", "open": "123", "close": "112"}
        with_weekend = E.study_features([weekday, weekend, target])
        without_weekend = E.study_features([weekday, target])
        self.assertEqual(with_weekend, without_weekend)
        self.assertFalse(E.is_dp("111"))
        self.assertAlmostEqual(with_weekend[(target["date"], "Sridevi")]["conditional"], 2 / 3)
        missing = E.study_features([weekday, {**target, "open": ""}])[(target["date"], "Sridevi")]
        self.assertEqual(missing["feature"], 0)
        self.assertIsNone(missing["conditional"])

    def test_zero_calls_is_undefined_precision(self) -> None:
        result = E.selective(np.array([1.0, 0.0]), np.array([False, False]))
        self.assertEqual(result["calls"], 0)
        self.assertIsNone(result["precision"])
        self.assertIsNone(result["precisionWilson95"])


class FrozenArtifacts(unittest.TestCase):
    def test_frozen_predictions_and_metrics(self) -> None:
        results = json.loads((E.HERE / "results.json").read_text(encoding="utf-8"))
        self.assertEqual(results["threshold"], 0.90)
        for name, expected in results["hashes"].items():
            self.assertEqual(E.digest(E.HERE / name), expected, name)
        with gzip.open(E.HERE / "predictions.jsonl.gz", "rt", encoding="utf-8") as stream:
            rows = [json.loads(line) for line in stream]
        self.assertEqual(sum(r["date"] <= E.FIT_END for r in rows), results["fit"]["n"])
        features = E.study_features(E.load_source())
        for row in rows:
            self.assertEqual(row["feature"], features[(row["date"], row["market"])]["feature"])
            self.assertLess(row["historyLast"], row["date"])
            self.assertGreaterEqual(row["historyLast"], row["historyStart"])
            self.assertFalse(row["verifiedCall"])
            vector = np.array([float(logit(row["raw"]))] +
                              [float(row["market"] == m) for m in results["models"]["columns"][1:]])
            expected = {
                "calibrated": expit(vector @ results["models"]["calibrated"]),
                "with_feature": expit(np.append(vector, row["feature"]) @ results["models"]["withFeature"]),
                "offset_feature": expit(vector[0] + results["models"]["offsetFeatureCoefficient"] * row["feature"]),
            }
            for model, p in expected.items():
                self.assertAlmostEqual(row[model], float(p), places=12)
            if not row["open"]:
                self.assertEqual(row["offset_feature"], row["raw"])
        live = [r for r in rows if r["date"] > E.FIT_END and r["open"]]
        for model in E.MODELS:
            self.assertEqual(E.metrics(live, model), results["blocks"]["all2026"]["models"][model])
        replay = json.loads((E.HERE / "replay-audit.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(replay["parityChecks"], 24)
        self.assertEqual(replay["outcomes"], len(rows))
        for name, expected in replay["productionCodeHashes"].items():
            self.assertEqual(E.digest(E.ROOT / "src/lib" / name), expected, name)


if __name__ == "__main__":
    unittest.main()
