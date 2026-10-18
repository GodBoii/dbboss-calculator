"""Check chronological isolation, runtime parity, and reproducible study results."""

from __future__ import annotations

import json
import subprocess
import unittest
from datetime import date, timedelta

import numpy as np

import run_study as study


class StudyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.markets, cls.manifest = study.load_rows()

    def test_no_current_or_future_panel_leakage(self) -> None:
        rows = next(iter(self.markets.values()))[-400:]
        for side in ("open", "close"):
            before = study.predict_series(rows, side)
            changed = [dict(row) for row in rows]
            for row in changed[250:]:
                row["open"], row["close"] = "999", "888"
            after = study.predict_series(changed, side)
            prefix = study.predict_series(rows[:251], side)
            for name in study.CANDIDATES:
                np.testing.assert_array_equal(before[name][:251], after[name][:251])
                np.testing.assert_array_equal(before[name][:251], prefix[name])

    def test_minimum_history_and_expired_history(self) -> None:
        rows = [{"date": (date(2020, 1, 1) + timedelta(days=i)).isoformat(),
                 "open": "123", "close": "456"} for i in range(182)]
        result = study.predict_series(rows, "open")
        self.assertTrue(np.all(result[study.BASELINE][:180] == -1))
        self.assertEqual(study.PAIRS[result[study.BASELINE][180]], (1, 2))
        rows[-1]["date"] = "2025-01-01"
        self.assertEqual(study.predict_series(rows, "open")[study.BASELINE][-1], -1)
        self.assertEqual(study.cutoff("2026-06-30"), "2024-02-29")

    def test_strict_scoring_and_paired_comparison(self) -> None:
        events = [{"hits": {study.BASELINE: False, "challenger": True}} for _ in range(6)]
        metric = study.metric(events, "challenger")
        self.assertEqual(metric["netHits"], 6)
        self.assertAlmostEqual(metric["pairedP"], 0.03125)
        self.assertEqual(study.metric(events, study.BASELINE)["pairedP"], 1)

    def test_baseline_matches_actual_typescript_runtime(self) -> None:
        # Feed the exact same pre-date, 28-month history into the public app API.
        cases = []
        expected = []
        for market, rows in self.markets.items():
            for index in (len(rows) - 1, len(rows) - 80):
                target = rows[index]["date"]
                history = [row for row in rows[:index] if row["date"] >= study.cutoff(target)]
                if len(history) < 180:
                    continue
                cases.append({"market": market, "target": target, "history": history})
                predictions = {side: study.predict_series(history + [rows[index]], side)[study.BASELINE][-1]
                               for side in ("open", "close")}
                expected.append({side: list(study.PAIRS[pair]) for side, pair in predictions.items()})
        javascript = r'''
const fs = require("fs"), ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020, esModuleInterop: true}}).outputText, filename);
const {buildPresentDigitsPredictionFromPanels: predict} = require("./src/lib/present-digits.ts");
const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const output = JSON.parse(fs.readFileSync(0, "utf8")).map(({market, target, history}) => {
  const records = history.map(row => {
    const day = new Date(row.date + "T00:00:00Z").getUTCDay();
    const [year, month, date] = row.date.split("-");
    const monday = new Date(row.date + "T00:00:00Z");
    monday.setUTCDate(monday.getUTCDate() - (day + 6) % 7);
    const start = monday.toISOString().slice(0, 10).split("-").reverse().join("/");
    return {market, day: names[day], dateRangeStart: start, dateRangeEnd: `${date}/${month}/${year}`,
      openPanel: row.open, closePanel: row.close};
  });
  const result = predict(market, records, new Date(target + "T12:00:00Z"));
  return result && {open: result.open.predictedDigits, close: result.close.predictedDigits};
});
process.stdout.write(JSON.stringify(output));
'''
        completed = subprocess.run(["node", "-e", javascript], cwd=study.ROOT,
                                   input=json.dumps(cases), capture_output=True, text=True,
                                   check=True, timeout=120)
        self.assertEqual(json.loads(completed.stdout), expected)
        self.assertEqual(len(cases), 24)

    def test_saved_results_reproduce_without_reselection(self) -> None:
        result = study.study(self.markets)
        result["sources"] = self.manifest
        saved = json.loads((study.HERE / "results.json").read_text(encoding="utf-8"))
        self.assertEqual(json.loads(json.dumps(result)), saved)
        development = result["comparisons"]["development"]
        winner = max((name for name in study.CANDIDATES if name != study.BASELINE),
                     key=lambda name: development[name]["hits"])
        self.assertEqual(result["selectedChallenger"], winner)
        self.assertEqual(result["eligibleForProspectiveTrial"], all(result["promotionGates"].values()))
        self.assertFalse(result["productionChanged"])


if __name__ == "__main__":
    unittest.main()
