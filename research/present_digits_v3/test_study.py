"""Behavior checks for pooled availability, model fitting, and reproducibility."""

from __future__ import annotations

import copy
import csv
import json
import unittest
from datetime import date, timedelta

import numpy as np

import run_study as study


def synthetic_markets() -> dict[str, list[dict[str, str]]]:
    markets = {}
    for offset, name in enumerate(("A", "B")):
        rows = []
        for index in range(900):
            iso = (date(2020, 1, 1) + timedelta(days=index)).isoformat()
            rows.append({"date": iso, "market": name,
                         "open": "".join(str((index * 7 + offset + j * 3) % 10) for j in range(3)),
                         "close": "".join(str((index * 3 + offset + j * 2) % 10) for j in range(3))})
        markets[name] = rows
    return markets


class StudyTests(unittest.TestCase):
    def test_pooled_counts_exclude_all_same_day_results(self) -> None:
        history = study.History(["2026-01-01", "2026-01-02", "2026-01-02"],
                                np.array([[0], [1], [3], [6]]))
        counts, total = history.counts("2026-01-02")
        np.testing.assert_array_equal(counts, [1])
        self.assertEqual(total, 1)

    def test_perturbing_targets_and_future_preserves_earlier_predictions(self) -> None:
        markets = synthetic_markets()
        before = study.build_dataset(markets)
        changed = copy.deepcopy(markets)
        boundary = "2022-02-15"
        for rows in changed.values():
            for row in rows:
                if row["date"] >= boundary:
                    row["open"], row["close"] = "999", "888"
        after = study.build_dataset(changed)
        mask = before.dates <= boundary
        for field in ("baseline", "pooled", "conditional", "context", "sequence"):
            np.testing.assert_array_equal(getattr(before, field)[mask], getattr(after, field)[mask])
        original_predictions, original_scores, _, audits = study.predict(before)
        changed_predictions, changed_scores, _, _ = study.predict(after)
        np.testing.assert_array_equal(original_predictions[mask], changed_predictions[mask])
        np.testing.assert_array_equal(original_scores[mask], changed_scores[mask])
        for audit in audits:
            self.assertLess(audit["latestTrain"], audit["quarter"])
            self.assertGreaterEqual(audit["earliestTrain"], study.previous.cutoff(audit["quarter"]))

    def test_ridge_recovers_a_real_linear_relationship(self) -> None:
        rng = np.random.default_rng(123)
        x = rng.normal(size=(1000, 4))
        weights = np.array([[0.03, 0.02], [-0.01, 0.05], [0.07, -0.03], [0.02, 0.01]])
        residuals = x @ weights + np.array([0.02, -0.01])
        result = study.ridge_corrections(x[:800], residuals[:800], x[800:], (1,))[1]
        self.assertLess(float(((result - residuals[800:]) ** 2).mean()), 1e-7)

    def test_week_bootstrap_preserves_cluster_uncertainty(self) -> None:
        dates = np.array(["2026-01-05"] * 100 + ["2026-01-12"] * 100)
        differences = np.array([1] * 100 + [-1] * 100)
        result = study.weekly_bootstrap(dates, differences)
        self.assertEqual(result["weeks"], 2)
        self.assertEqual(result["meanLift"], 0)
        self.assertEqual(result["interval95"], [-1, 1])

    def test_complete_study_reproduces_and_matches_live_baseline_study(self) -> None:
        markets, manifest = study.previous.load_rows()
        data = study.build_dataset(markets)
        predictions, _, losses, fits = study.predict(data)
        result = study.evaluate(data, predictions, losses)
        saved = json.loads((study.HERE / "results.json").read_text(encoding="utf-8"))
        for key, value in result.items():
            self.assertEqual(json.loads(json.dumps(value)), saved[key])
        self.assertEqual(manifest, saved["sources"])
        self.assertEqual(fits, saved["quarterlyFits"])
        self.assertEqual(study.text_sha256(study.HERE / "protocol.json"), saved["protocolSHA256"])
        old = json.loads((study.previous.HERE / "results.json").read_text(encoding="utf-8"))
        for new_block, old_block in (("development", "development"), ("validation", "validation2024"),
                                     ("confirmation", "confirmation2025"), ("recent", "recent2026"),
                                     ("last30", "last30"), ("last90", "last90"), ("last180", "last180")):
            base = result["comparisons"][new_block][study.BASELINE]
            self.assertEqual(base["events"], old["comparisons"][old_block][study.BASELINE]["events"])
            self.assertEqual(base["hits"], old["comparisons"][old_block][study.BASELINE]["hits"])
        # The older study's baseline already has parity with the public TypeScript API.
        for market, rows in markets.items():
            for side in ("open", "close"):
                indices = np.flatnonzero(data.routes == f"{market}|{side}")
                expected = study.previous.predict_series(rows, side)[study.BASELINE]
                by_date = {row["date"]: int(expected[index]) for index, row in enumerate(rows)}
                np.testing.assert_array_equal(predictions[indices, 0], [by_date[iso] for iso in data.dates[indices]])
        audit_path = study.HERE / "audit.csv"
        self.assertEqual(study.text_sha256(audit_path), saved["auditSHA256"])
        with audit_path.open(encoding="utf-8", newline="") as handle:
            ledger = list(csv.DictReader(handle))
        self.assertEqual(len(ledger), sum(v[study.BASELINE]["events"] for k, v in result["comparisons"].items()
                                          if k in ("development", "validation", "confirmation", "recent")))
        self.assertEqual(sum(int(row["candidate_hit"]) for row in ledger),
                         sum(v[result["selectedChallenger"]]["hits"] for k, v in result["comparisons"].items()
                             if k in ("development", "validation", "confirmation", "recent")))


if __name__ == "__main__":
    unittest.main()
