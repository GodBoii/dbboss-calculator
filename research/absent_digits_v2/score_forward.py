from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

from run_research import HERE, load_rows, panel_for


REGISTRY = HERE / "FROZEN_FORWARD_REGISTRY.json"
CALIBRATION_REGISTRY = HERE / "FROZEN_CALIBRATION_REGISTRY.json"
OUTPUT_JSON = HERE / "FORWARD_SCORE.json"
OUTPUT_REPORT = HERE / "FORWARD_SCORE.md"


def main() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    calibration = json.loads(
        CALIBRATION_REGISTRY.read_text(encoding="utf-8")
    )
    if calibration["baseRegistryContentHash"] != registry["contentHash"]:
        raise RuntimeError(
            "Calibration addendum does not match the frozen prediction registry"
        )
    calibrated_by_key = {
        (row["market"], row["side"]): row
        for row in calibration["rows"]
    }
    rows_by_market, source_meta = load_rows()
    scored_rows = []

    for frozen in registry["rows"]:
        calibrated = calibrated_by_key[(frozen["market"], frozen["side"])]
        actual_row = next(
            (
                row
                for row in rows_by_market[frozen["market"]]
                if row["isoDate"] == frozen["targetDate"]
            ),
            None,
        )
        actual_panel = (
            panel_for(actual_row, frozen["side"]) if actual_row else None
        )
        if actual_panel is None:
            result = "PENDING"
            hit = None
        else:
            present = {int(value) for value in actual_panel}
            hit = all(
                digit not in present for digit in frozen["candidateAvoidDigits"]
            )
            result = "HIT" if hit else "MISS"
        scored_rows.append(
            {
                "market": frozen["market"],
                "side": frozen["side"],
                "targetDate": frozen["targetDate"],
                "frozenStatus": frozen["status"],
                "candidateAvoidDigits": frozen["candidateAvoidDigits"],
                "calibratedConfidence": calibrated["confidence"],
                "legacyConfidence": frozen["confidence"],
                "actualPanel": actual_panel,
                "result": result,
                "hit": hit,
            }
        )

    callable_rows = [
        row for row in scored_rows if row["frozenStatus"] == "CALL"
    ]
    scored_calls = [row for row in callable_rows if row["hit"] is not None]
    research_candidates = [
        row for row in scored_rows if row["hit"] is not None
    ]
    calibration_rows = [
        row for row in scored_rows if row["hit"] is not None
    ]

    def proper_scores(field: str) -> dict[str, float | None]:
        if not calibration_rows:
            return {"brier": None, "logLoss": None}
        probabilities = [row[field] for row in calibration_rows]
        outcomes = [int(row["hit"]) for row in calibration_rows]
        return {
            "brier": sum(
                (probability - outcome) ** 2
                for probability, outcome in zip(probabilities, outcomes)
            )
            / len(outcomes),
            "logLoss": -sum(
                outcome * math.log(probability)
                + (1 - outcome) * math.log(1 - probability)
                for probability, outcome in zip(probabilities, outcomes)
            )
            / len(outcomes),
        }

    calibrated_scores = proper_scores("calibratedConfidence")
    legacy_scores = proper_scores("legacyConfidence")
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "registryContentHash": registry["contentHash"],
        "calibrationRegistryContentHash": calibration["contentHash"],
        "sourceMeta": source_meta,
        "calls": {
            "frozen": len(callable_rows),
            "scored": len(scored_calls),
            "hits": sum(row["hit"] is True for row in scored_calls),
            "accuracy": (
                sum(row["hit"] is True for row in scored_calls)
                / len(scored_calls)
                if scored_calls
                else None
            ),
        },
        "researchCandidates": {
            "scored": len(research_candidates),
            "hits": sum(row["hit"] is True for row in research_candidates),
            "accuracy": (
                sum(row["hit"] is True for row in research_candidates)
                / len(research_candidates)
                if research_candidates
                else None
            ),
        },
        "calibration": {
            "id": calibration["calibrationId"],
            "scored": len(calibration_rows),
            "calibrated": calibrated_scores,
            "legacy": legacy_scores,
            "brierDelta": (
                calibrated_scores["brier"] - legacy_scores["brier"]
                if calibrated_scores["brier"] is not None
                and legacy_scores["brier"] is not None
                else None
            ),
        },
        "pending": sum(row["result"] == "PENDING" for row in scored_rows),
        "rows": scored_rows,
    }
    OUTPUT_JSON.write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        "# Absent-Digits Frozen Forward Score",
        "",
        f"Generated: {payload['generatedAt']}",
        f"Registry: `{payload['registryContentHash']}`",
        f"Calibration registry: "
        f"`{payload['calibrationRegistryContentHash']}`",
        "",
        f"- Frozen calls: {payload['calls']['frozen']}",
        f"- Scored calls: {payload['calls']['scored']}",
        f"- Pending rows: {payload['pending']}",
        f"- Scored research candidates: "
        f"{payload['researchCandidates']['scored']}",
        f"- Calibration rows scored: {payload['calibration']['scored']}",
    ]
    if payload["calibration"]["scored"]:
        lines.extend(
            [
                f"- Calibrated Brier: "
                f"{payload['calibration']['calibrated']['brier']:.5f}",
                f"- Legacy Brier: "
                f"{payload['calibration']['legacy']['brier']:.5f}",
                f"- Calibrated minus legacy Brier: "
                f"{payload['calibration']['brierDelta']:.5f}",
            ]
        )
    lines.extend(
        [
            "",
            "| Market | Side | Target | Frozen status | Candidate | Confidence | Actual | Result |",
            "| --- | --- | --- | --- | ---: | ---: | ---: | --- |",
        ]
    )
    for row in scored_rows:
        lines.append(
            f"| {row['market']} | {row['side']} | {row['targetDate']} | "
            f"{row['frozenStatus']} | "
            f"{''.join(map(str, row['candidateAvoidDigits']))} | "
            f"{row['calibratedConfidence'] * 100:.1f}% | "
            f"{row['actualPanel'] or '-'} | {row['result']} |"
        )
    OUTPUT_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
