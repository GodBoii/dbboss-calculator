"""Verify saved panel comparisons, feature causality, precision, and fitted ranks."""
from __future__ import annotations

import gzip
import json
import pickle
import unittest

import numpy as np
from threadpoolctl import threadpool_limits

from run import (
    COMPARATOR, DEPLOY_COLUMNS, FIT_END, HERE, MODEL_NAMES, PANELS, PIDX,
    ROOT, SOURCE, build_features, digest, features, load_source, paired,
    predict, rounded_production_spec, top10,
)


class PanelResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.markets, cls.comparator = load_source()
        cls.results = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
        with gzip.open(HERE / "predictions.jsonl.gz", "rt", encoding="utf-8") as handle:
            cls.ledger = [json.loads(line) for line in handle]
        cls.lookup = {(row["market"], row["date"]): row for row in cls.comparator}

    def test_model_and_data_hashes(self) -> None:
        audit = self.results["audit"]
        self.assertEqual(digest(SOURCE), audit["sourceSHA256"])
        self.assertEqual(digest(COMPARATOR), audit["comparatorSHA256"])
        self.assertEqual(digest(HERE / "predictions.jsonl.gz"), audit["ledgerSHA256"])
        for filename, expected in audit["code"].items():
            self.assertEqual(digest(ROOT / filename), expected, filename)
        for side, expected in audit["models"].items():
            self.assertEqual(digest(HERE / f"{side}-model.pkl"), expected)

    def test_prediction_counts_scores_comparator_and_complete_coverage(self) -> None:
        expected = {key for key in self.lookup if key[1] > FIT_END}
        found = {(row["market"], row["date"]) for row in self.ledger}
        self.assertEqual(found, expected)
        self.assertEqual(len(found), len(self.ledger))
        for row in self.ledger:
            baseline = self.lookup[(row["market"], row["date"])]
            self.assertEqual(row["actual"], baseline["actual"])
            for side, production_side in (("open", "open"), ("close", "closeLive")):
                value = row[side]
                self.assertEqual(value["candidate"], self.results["sides"][side]["selected"])
                self.assertEqual(len(value["panels"]), 10)
                self.assertEqual(len(set(value["panels"])), 10)
                self.assertTrue(all(panel in PIDX for panel in value["panels"]))
                self.assertEqual(value["productionPanels"], baseline["predictions"]["production"][production_side]["panels"])
                actual = row["actual"]["openPanel" if side == "open" else "closePanel"]
                self.assertEqual(value["candidateHit"], int(actual in value["panels"]))
                self.assertEqual(value["productionHit"], int(actual in value["productionPanels"]))

    def test_selection_summaries_and_promotion_gate(self) -> None:
        for side, result in self.results["sides"].items():
            selected = max(MODEL_NAMES, key=lambda name: result["selection"][name]["hits"])
            self.assertEqual(selected, result["selected"])
            self.assertEqual(paired(self.ledger, side), result["later"])
            self.assertEqual(paired([row for row in self.ledger if row["date"] >= "2026-09-01"], side), result["septemberOctober"])
            self.assertEqual(paired([row for row in self.ledger if row["date"] >= "2026-09-09"], side), result["recent30"])
            improving = 0
            for market, market_result in result["perMarket"].items():
                self.assertEqual(paired([row for row in self.ledger if row["market"] == market], side), market_result)
                improving += int(market_result["lift"] > 0)
            self.assertEqual(improving, result["improvingMarkets"])
            qualifies = result["later"]["interval975"][0] > 0 and result["septemberOctober"]["lift"] > 0 and result["recent30"]["lift"] > 0 and improving >= 6
            self.assertEqual(result["decision"], "QUALIFIES_FOR_RUNTIME_VALIDATION" if qualifies else "REJECT")

    def test_default_builder_precision_and_date_limit_are_preserved(self) -> None:
        short = {"Sridevi": self.markets["Sridevi"][-65:]}
        default_x, default_y, default_meta = features.build(short, "open")
        explicit_x, explicit_y, explicit_meta = features.build(short, "open", dtype=np.float32, end_date="2026-09-30")
        self.assertEqual(default_x.dtype, np.float32)
        self.assertTrue(all(iso <= "2026-09-30" for _, iso in default_meta))
        np.testing.assert_array_equal(default_x, explicit_x)
        np.testing.assert_array_equal(default_y, explicit_y)
        self.assertEqual(default_meta, explicit_meta)
        precise_x, _, precise_meta = build_features(short, "open")
        self.assertEqual(precise_x.dtype, np.float64)
        self.assertIn(("Sridevi", "2026-10-08"), precise_meta)
        for index, key in enumerate(default_meta):
            precise_index = precise_meta.index(key)
            np.testing.assert_allclose(default_x[index][:, DEPLOY_COLUMNS], precise_x[precise_index], atol=1e-6, rtol=1e-6)

    def test_current_close_and_future_rows_cannot_enter_earlier_features(self) -> None:
        rows = self.markets["Sridevi"][-65:]
        short = {"Sridevi": rows}
        changed_close = {"Sridevi": [*rows[:-1], (rows[-1][0], rows[-1][1], PIDX["111"])]}
        changed_open = {"Sridevi": [*rows[:-1], (rows[-1][0], PIDX["111"], rows[-1][2])]}
        future = {"Sridevi": [*rows, ("2026-10-09", PIDX["999"], PIDX["000"])]}
        for side in ("open", "close"):
            x, y, meta = build_features(short, side)
            close_x, _, close_meta = build_features(changed_close, side)
            future_x, _, future_meta = build_features(future, side)
            self.assertEqual(meta, close_meta)
            self.assertEqual(meta, future_meta)
            np.testing.assert_array_equal(x, close_x)
            np.testing.assert_array_equal(x, future_x)
            open_x, _, open_meta = build_features(changed_open, side)
            self.assertEqual(meta, open_meta)
            if side == "open":
                np.testing.assert_array_equal(x, open_x)
            else:
                self.assertFalse(np.array_equal(x[-1], open_x[-1]))
            self.assertTrue(np.all(np.isfinite(x)))
            self.assertEqual(x.shape[1], len(PANELS))
            self.assertEqual(len(y), len(meta))

    def test_saved_model_and_double_precision_production_reproduce_every_later_rank(self) -> None:
        ledger = {(row["market"], row["date"]): row for row in self.ledger}
        for side in ("open", "close"):
            x, _, meta = build_features(self.markets, side)
            keep = np.array([key in ledger for key in meta])
            x = x[keep]
            meta = [key for key, retained in zip(meta, keep) if retained]
            spec = rounded_production_spec(side)
            production_order = top10(((x - spec["mean"]) / spec["std"]) @ spec["weights"])
            # Only load the local artifact after its hash has been checked.
            self.assertEqual(digest(HERE / f"{side}-model.pkl"), self.results["audit"]["models"][side])
            with (HERE / f"{side}-model.pkl").open("rb") as handle:
                model = pickle.load(handle)
            order = predict(self.results["sides"][side]["selected"], model, x)
            for index, key in enumerate(meta):
                self.assertEqual([PANELS[p] for p in order[index]], ledger[key][side]["panels"])
                self.assertEqual([PANELS[p] for p in production_order[index]], ledger[key][side]["productionPanels"])


if __name__ == "__main__":
    with threadpool_limits(limits=2):
        unittest.main()
