"""Market-specific categorical Bayesian Open/Close sutta research.

Four chronological blocks are used:
train (age >=365), development (213-364), validation (30-212), holdout (0-29).
Hyperparameters are selected on development, checked on validation, and scored
once on holdout after refitting. Production ranks 1-4 remain frozen.
"""

from __future__ import annotations

import bisect
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scratch" / "sutta-research-records.json"
BASELINE = ROOT / "scratch" / "sutta-baseline-730d-cross-market-baseline.json"
OUTPUT = ROOT / "scratch" / "cross-market-sutta-bayes-output.json"
MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Rajdhani Day", "Milan Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar",
]
OPEN_MINUTE = {
    "Sridevi": 695, "Time Bazar": 790, "Madhur Day": 810, "Rajdhani Day": 905,
    "Milan Day": 910, "Kalyan": 945, "Sridevi Night": 1155, "Madhur Night": 1230,
    "Milan Night": 1265, "Rajdhani Night": 1295, "Kalyan Night": 1305, "Main Bazar": 1320,
}
CLOSE_MINUTE = {
    "Sridevi": 755, "Time Bazar": 850, "Madhur Day": 870, "Rajdhani Day": 1025,
    "Milan Day": 1030, "Kalyan": 1065, "Sridevi Night": 1215, "Madhur Night": 1350,
    "Milan Night": 1385, "Rajdhani Night": 1415, "Kalyan Night": 1425, "Main Bazar": 1450,
}
DAY_OFFSET = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}


@dataclass(frozen=True)
class Row:
    market: str
    iso: str
    day: str
    open: int
    close: int
    open_panel: str
    close_panel: str

    @property
    def dom(self) -> int:
        return date.fromisoformat(self.iso).day

    @property
    def wom(self) -> int:
        return (self.dom - 1) // 7 + 1


@dataclass
class Case:
    market: str
    iso: str
    block: str
    target: int
    baseline: list[int]
    features: dict[str, int]


def iso_date(record: dict) -> str:
    start = datetime.strptime(record["dateRangeStart"].replace("-", "/"), "%d/%m/%Y").date()
    return (start + timedelta(days=DAY_OFFSET[record["day"]])).isoformat()


def load_rows() -> tuple[dict[str, list[Row]], dict[tuple[str, str], dict]]:
    raw = json.loads(CACHE.read_text(encoding="utf-8"))
    result = {}
    for market in MARKETS:
        result[market] = sorted([
            Row(
                market, iso_date(record), record["day"], int(record["openSutta"]), int(record["closeSutta"]),
                str(record.get("openPanel") or ""), str(record.get("closePanel") or ""),
            )
            for record in raw[market] if record.get("openPanel") and record.get("closePanel")
        ], key=lambda row: row.iso)
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    return result, {(row["market"], row["isoDate"]): row for row in baseline["ledger"]}


def block_for(age: int) -> str:
    if age >= 365:
        return "train"
    if age >= 213:
        return "development"
    if age >= 30:
        return "validation"
    return "holdout30"


def panel_features(features: dict[str, int], prefix: str, panel: str) -> None:
    if len(panel) != 3:
        return
    features[f"{prefix}:first"] = int(panel[0])
    features[f"{prefix}:middle"] = int(panel[1])
    features[f"{prefix}:last"] = int(panel[2])
    features[f"{prefix}:kind"] = len(set(panel))
    features[f"{prefix}:houseMask"] = sum((int(digit) >= 5) << index for index, digit in enumerate(panel))


def build_cases() -> dict[tuple[str, str], list[Case]]:
    rows, ledger = load_rows()
    dates = {market: [row.iso for row in market_rows] for market, market_rows in rows.items()}
    maps = {market: {row.iso: row for row in market_rows} for market, market_rows in rows.items()}

    def previous(market: str, iso: str) -> Row | None:
        index = bisect.bisect_left(dates[market], iso) - 1
        return rows[market][index] if index >= 0 else None

    cases = defaultdict(list)
    for market in MARKETS:
        newest = date.fromisoformat(rows[market][-1].iso)
        prior = []
        for row in rows[market]:
            base = ledger.get((market, row.iso))
            if base and len(prior) >= 50:
                age = (newest - date.fromisoformat(row.iso)).days
                if age <= 730:
                    common: dict[str, int] = {
                        "calendar:weekday": DAY_OFFSET[row.day],
                        "calendar:dom": row.dom,
                        "calendar:wom": row.wom,
                    }
                    for lag in (1, 2, 3, 5, 7):
                        if len(prior) >= lag:
                            common[f"own:open:lag{lag}"] = prior[-lag].open
                            common[f"own:close:lag{lag}"] = prior[-lag].close
                            panel_features(common, f"own:openPanel:lag{lag}", prior[-lag].open_panel)
                            panel_features(common, f"own:closePanel:lag{lag}", prior[-lag].close_panel)
                    weekday = next((item for item in reversed(prior) if item.day == row.day), None)
                    same_date = next((item for item in reversed(prior) if item.dom == row.dom), None)
                    same_week = next((item for item in reversed(prior) if item.wom == row.wom and item.day == row.day), None)
                    for label, item in (("weekday", weekday), ("date", same_date), ("weekMonth", same_week)):
                        if item:
                            common[f"echo:{label}:open"] = item.open
                            common[f"echo:{label}:close"] = item.close
                    for source_market in MARKETS:
                        source = previous(source_market, row.iso)
                        if source:
                            common[f"previous:{source_market}:open"] = source.open
                            common[f"previous:{source_market}:close"] = source.close
                            panel_features(common, f"previous:{source_market}:openPanel", source.open_panel)
                            panel_features(common, f"previous:{source_market}:closePanel", source.close_panel)
                        if CLOSE_MINUTE[source_market] < OPEN_MINUTE[market]:
                            same = maps[source_market].get(row.iso)
                            if same:
                                common[f"sameDay:{source_market}:open"] = same.open
                                common[f"sameDay:{source_market}:close"] = same.close
                                panel_features(common, f"sameDay:{source_market}:openPanel", same.open_panel)
                                panel_features(common, f"sameDay:{source_market}:closePanel", same.close_panel)
                    for side in ("open", "close"):
                        cases[(market, side)].append(Case(
                            market=market, iso=row.iso, block=block_for(age), target=getattr(row, side),
                            baseline=list(base[f"{side}Ranking"]), features=dict(common),
                        ))
            prior.append(row)
    return cases


FAMILIES = {
    "temporal": ("calendar:", "own:", "echo:"),
    "previous_sutta": ("calendar:", "own:", "echo:", "previous:"),
    "same_day": ("calendar:", "own:", "echo:", "sameDay:"),
    "all": ("calendar:", "own:", "echo:", "previous:", "sameDay:"),
}


class CategoricalBayes:
    def __init__(self, alpha: float, weight: float, prefixes: tuple[str, ...]) -> None:
        self.alpha, self.weight, self.prefixes = alpha, weight, prefixes
        self.class_counts = Counter()
        self.counts = defaultdict(lambda: defaultdict(Counter))
        self.values = defaultdict(set)

    def fit(self, cases: list[Case]) -> None:
        for case in cases:
            self.class_counts[case.target] += 1
            for name, value in case.features.items():
                if not name.startswith(self.prefixes):
                    continue
                self.counts[name][case.target][value] += 1
                self.values[name].add(value)

    def scores(self, case: Case) -> list[float]:
        total = sum(self.class_counts.values())
        result = []
        for digit in range(10):
            class_n = self.class_counts[digit]
            score = math.log((class_n + self.alpha) / (total + self.alpha * 10))
            for name, value in case.features.items():
                if not name.startswith(self.prefixes) or name not in self.values:
                    continue
                observed = self.counts[name][digit][value]
                denominator = class_n + self.alpha * max(1, len(self.values[name]))
                score += self.weight * math.log((observed + self.alpha) / denominator)
            result.append(score)
        return result


def softmax(scores: list[float]) -> list[float]:
    maximum = max(scores)
    weights = [math.exp(score - maximum) for score in scores]
    total = sum(weights)
    return [weight / total for weight in weights]


def prediction(model: CategoricalBayes, case: Case) -> tuple[list[int], float]:
    scores = model.scores(case)
    ordering = sorted(range(10), key=lambda digit: (-scores[digit], digit))
    result = list(case.baseline[:4])
    result.extend(digit for digit in ordering if digit not in result)
    result = result[:6]
    probabilities = softmax(scores)
    return result, sum(probabilities[digit] for digit in result)


def metric(model: CategoricalBayes, cases: list[Case]) -> dict:
    baseline = candidate = 0
    rows = []
    for case in cases:
        predicted, confidence = prediction(model, case)
        baseline_hit = case.target in case.baseline
        candidate_hit = case.target in predicted
        baseline += baseline_hit
        candidate += candidate_hit
        rows.append({"baseline": baseline_hit, "candidate": candidate_hit, "confidence": confidence})
    return {"n": len(cases), "baseline": baseline, "candidate": candidate, "delta": candidate - baseline, "rows": rows}


def evaluate() -> dict:
    all_cases = build_cases()
    results = []
    selective90 = []
    for (market, side), cases in all_cases.items():
        blocks = {name: [case for case in cases if case.block == name] for name in ("train", "development", "validation", "holdout30")}
        variants = []
        for family, prefixes in FAMILIES.items():
            for alpha in (1.0, 2.0, 5.0):
                for weight in (0.05, 0.1, 0.2, 0.35):
                    model = CategoricalBayes(alpha, weight, prefixes)
                    model.fit(blocks["train"])
                    development = metric(model, blocks["development"])
                    variants.append((development["delta"], development["candidate"], family, alpha, weight, development))
        selected = max(variants, key=lambda row: (row[0], row[1], row[2], -row[3], -row[4]))
        _, _, family, alpha, weight, development = selected
        validation_model = CategoricalBayes(alpha, weight, FAMILIES[family])
        validation_model.fit(blocks["train"] + blocks["development"])
        validation = metric(validation_model, blocks["validation"])
        holdout_model = CategoricalBayes(alpha, weight, FAMILIES[family])
        holdout_model.fit(blocks["train"] + blocks["development"] + blocks["validation"])
        holdout = metric(holdout_model, blocks["holdout30"])
        decision = "promote" if development["delta"] > 0 and validation["delta"] > 0 and holdout["delta"] >= 0 else "revert_to_baseline"
        results.append({
            "market": market, "side": side, "family": family, "alpha": alpha, "weight": weight,
            "decision": decision, "development": {k: v for k, v in development.items() if k != "rows"},
            "validation": {k: v for k, v in validation.items() if k != "rows"},
            "holdout30": {k: v for k, v in holdout.items() if k != "rows"},
        })
        # Select confidence threshold on validation, then score holdout once.
        for threshold in (0.65, 0.75, 0.85, 0.9, 0.95):
            validation_rows = [row for row in validation["rows"] if row["confidence"] >= threshold]
            holdout_rows = [row for row in holdout["rows"] if row["confidence"] >= threshold]
            if len(validation_rows) < 30 or not holdout_rows:
                continue
            validation_accuracy = sum(row["candidate"] for row in validation_rows) / len(validation_rows)
            if validation_accuracy >= 0.9:
                selective90.append({
                    "market": market, "side": side, "family": family, "threshold": threshold,
                    "validationN": len(validation_rows), "validationAccuracy": validation_accuracy,
                    "holdoutN": len(holdout_rows),
                    "holdoutAccuracy": sum(row["candidate"] for row in holdout_rows) / len(holdout_rows),
                })
    return {"generatedAt": datetime.now().astimezone().isoformat(), "results": results, "selective90": selective90}


def main() -> None:
    report = evaluate()
    OUTPUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for row in report["results"]:
        print(row)
    print(f"\nValidated >=90% selective regions: {len(report['selective90'])}")
    for row in report["selective90"]:
        print(row)
    print(f"\nSaved {OUTPUT}")


if __name__ == "__main__":
    main()
