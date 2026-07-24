from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from run_research import (
    EXTENDED,
    INDEPENDENT,
    RANDOM_PAIR_BASE,
    load_rows,
    next_scheduled_date,
    panel_for,
    reliability_for_latest,
    run_series,
)


HERE = Path(__file__).resolve().parent
COHORT_DIR = HERE / "forward_cohorts"
MANIFEST = HERE / "FORWARD_JOURNAL.json"
REPORT = HERE / "FORWARD_JOURNAL.md"
BASE_REGISTRY = HERE / "FROZEN_FORWARD_REGISTRY.json"
BASE_CALIBRATION = HERE / "FROZEN_CALIBRATION_REGISTRY.json"
MODEL_RUNNER = HERE / "run_research.py"
MODEL_ID = "absent-digits-complementary-online-v2"
CALIBRATION_ID = "local-beta-w240-s80-v1"
BLEND = 0.75


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_hash(core: dict[str, Any]) -> str:
    canonical = json.dumps(
        core, sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(canonical).hexdigest()


def hashed(core: dict[str, Any]) -> dict[str, Any]:
    return {**core, "contentHash": canonical_hash(core)}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )


def verify_hashed(payload: dict[str, Any], label: str) -> None:
    core = {
        key: value
        for key, value in payload.items()
        if key != "contentHash"
    }
    expected = canonical_hash(core)
    if payload.get("contentHash") != expected:
        raise RuntimeError(f"{label} content hash mismatch")


def cohort_prediction_path(cohort_id: str) -> Path:
    return COHORT_DIR / f"{cohort_id}.predictions.json"


def cohort_score_path(cohort_id: str) -> Path:
    return COHORT_DIR / f"{cohort_id}.score.json"


def seed_cohort() -> dict[str, Any]:
    base = read_json(BASE_REGISTRY)
    calibration = read_json(BASE_CALIBRATION)
    calibrated_by_key = {
        (row["market"], row["side"]): row
        for row in calibration["rows"]
    }
    rows = []
    for frozen in base["rows"]:
        calibrated = calibrated_by_key[(frozen["market"], frozen["side"])]
        rows.append(
            {
                **frozen,
                "legacyConfidence": frozen["confidence"],
                "confidence": calibrated["confidence"],
                "confidenceSample": calibrated["calibrationSample"],
            }
        )
    core = {
        "schemaVersion": 1,
        "cohortId": "cohort-001",
        "generatedAt": base["generatedAt"],
        "purpose": (
            "Seed cohort copied without prediction changes from the immutable "
            "base and calibrated forward registries."
        ),
        "previousCohortContentHash": None,
        "modelId": base["modelId"],
        "modelCodeHash": base["codeHash"],
        "sourceHash": base["sourceHash"],
        "appearanceBlendWeight": base["appearanceBlendWeight"],
        "baseRegistryContentHash": base["contentHash"],
        "calibrationId": calibration["calibrationId"],
        "calibrationEvidenceHash": calibration["contentHash"],
        "gate": base["gate"],
        "rows": rows,
        "calls": base["calls"],
        "abstentions": base["abstentions"],
    }
    return hashed(core)


def manifest_core(
    cohorts: list[dict[str, Any]],
    created_at: str,
    updated_at: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "purpose": (
            "Append-only hash chain of genuinely prospective absent-digits "
            "prediction cohorts. Scores never alter prediction files."
        ),
        "cohorts": cohorts,
    }


def cohort_entry(cohort: dict[str, Any]) -> dict[str, Any]:
    cohort_id = cohort["cohortId"]
    return {
        "cohortId": cohort_id,
        "predictionsFile": f"forward_cohorts/{cohort_id}.predictions.json",
        "scoreFile": f"forward_cohorts/{cohort_id}.score.json",
        "contentHash": cohort["contentHash"],
        "previousCohortContentHash": cohort[
            "previousCohortContentHash"
        ],
        "modelCodeHash": cohort["modelCodeHash"],
        "sourceHash": cohort["sourceHash"],
        "targets": sorted(
            {row["targetDate"] for row in cohort["rows"]}
        ),
    }


def initialize() -> dict[str, Any]:
    if MANIFEST.exists():
        verify_journal()
        return read_json(MANIFEST)
    COHORT_DIR.mkdir(parents=True, exist_ok=True)
    cohort = seed_cohort()
    prediction_path = cohort_prediction_path(cohort["cohortId"])
    if prediction_path.exists():
        raise RuntimeError(
            f"Refusing to overwrite existing {prediction_path.name}"
        )
    write_json(prediction_path, cohort)
    now = utc_now()
    manifest = hashed(
        manifest_core([cohort_entry(cohort)], now, now)
    )
    write_json(MANIFEST, manifest)
    return manifest


def score_cohort(
    cohort: dict[str, Any],
    rows_by_market: dict[str, list[dict[str, Any]]],
    generated_at: str,
) -> dict[str, Any]:
    scored_rows = []
    for frozen in cohort["rows"]:
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
            hit = None
            result = "PENDING"
        else:
            present = {int(value) for value in actual_panel}
            hit = all(
                digit not in present
                for digit in frozen["candidateAvoidDigits"]
            )
            result = "HIT" if hit else "MISS"
        scored_rows.append(
            {
                "market": frozen["market"],
                "side": frozen["side"],
                "targetDate": frozen["targetDate"],
                "frozenStatus": frozen["status"],
                "candidateAvoidDigits": frozen["candidateAvoidDigits"],
                "confidence": frozen["confidence"],
                "actualPanel": actual_panel,
                "hit": hit,
                "result": result,
            }
        )
    observed = [row for row in scored_rows if row["hit"] is not None]
    if observed:
        brier = sum(
            (
                row["confidence"] - int(bool(row["hit"]))
            )
            ** 2
            for row in observed
        ) / len(observed)
        log_loss = -sum(
            int(bool(row["hit"])) * math.log(row["confidence"])
            + (1 - int(bool(row["hit"])))
            * math.log(1 - row["confidence"])
            for row in observed
        ) / len(observed)
    else:
        brier = None
        log_loss = None
    core = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "cohortId": cohort["cohortId"],
        "predictionContentHash": cohort["contentHash"],
        "scored": len(observed),
        "pending": len(scored_rows) - len(observed),
        "hits": sum(row["hit"] is True for row in observed),
        "strictAccuracy": (
            sum(row["hit"] is True for row in observed) / len(observed)
            if observed
            else None
        ),
        "calibration": {
            "id": cohort["calibrationId"],
            "brier": brier,
            "logLoss": log_loss,
        },
        "rows": scored_rows,
    }
    return hashed(core)


def score_all() -> list[dict[str, Any]]:
    manifest = initialize()
    rows_by_market, _ = load_rows()
    generated_at = utc_now()
    scores = []
    for entry in manifest["cohorts"]:
        cohort = read_json(HERE / entry["predictionsFile"])
        score = score_cohort(cohort, rows_by_market, generated_at)
        write_json(HERE / entry["scoreFile"], score)
        scores.append(score)
    write_report(manifest, scores)
    return scores


def model_source_hash() -> str:
    return hashlib.sha256(
        EXTENDED.read_bytes() + b"\n" + INDEPENDENT.read_bytes()
    ).hexdigest()


def confidence_for_series(
    series: list[dict[str, Any]],
) -> tuple[float, int, int]:
    history = series[:-1][-240:]
    hits = sum(
        bool(row["blendHits"][str(BLEND)]) for row in history
    )
    sample = len(history)
    confidence = (
        hits + RANDOM_PAIR_BASE * 80
    ) / (sample + 80)
    return confidence, hits, sample


def build_next_cohort(
    manifest: dict[str, Any],
    last_cohort: dict[str, Any],
) -> dict[str, Any]:
    current_model_hash = hashlib.sha256(
        MODEL_RUNNER.read_bytes()
    ).hexdigest()
    if current_model_hash != last_cohort["modelCodeHash"]:
        raise RuntimeError(
            "Model code changed since the last cohort; complete a separately "
            "audited model-version promotion before registering predictions."
        )
    rows_by_market, _ = load_rows()
    previous_targets = {
        row["market"]: row["targetDate"]
        for row in last_cohort["rows"]
    }
    cohort_number = len(manifest["cohorts"]) + 1
    cohort_id = f"cohort-{cohort_number:03d}"
    registered_rows = []
    for market, historical in rows_by_market.items():
        latest = date.fromisoformat(historical[-1]["isoDate"])
        previous = date.fromisoformat(previous_targets[market])
        earliest = max(latest + timedelta(days=1), previous + timedelta(days=1))
        target_date, day_name = next_scheduled_date(
            historical, earliest
        )
        cutoff = (
            date.fromisoformat(target_date) - timedelta(days=729)
        ).isoformat()
        runtime_history = [
            row
            for row in historical
            if cutoff <= row["isoDate"] <= historical[-1]["isoDate"]
        ]
        placeholder = {
            "market": market,
            "isoDate": target_date,
            "day": day_name,
            "openPanel": "000",
            "closePanel": "000",
            "source": "unobserved_target_placeholder",
        }
        for side in ("open", "close"):
            series = run_series(
                market, side, runtime_history + [placeholder]
            )
            candidate = reliability_for_latest(series, BLEND)
            confidence, confidence_hits, confidence_sample = (
                confidence_for_series(series)
            )
            registered_rows.append(
                {
                    **candidate,
                    "confidence": confidence,
                    "confidenceHits": confidence_hits,
                    "confidenceSample": confidence_sample,
                    "targetDate": target_date,
                    "sourceCutoff": historical[-1]["isoDate"],
                    "status": (
                        "CALL"
                        if candidate["strictCall"]
                        else "NO_SAFE_CALL"
                    ),
                }
            )
    generated_at = utc_now()
    core = {
        "schemaVersion": 1,
        "cohortId": cohort_id,
        "generatedAt": generated_at,
        "purpose": (
            "Hash-frozen prediction cohort registered only after the prior "
            "cohort became fully observable."
        ),
        "previousCohortContentHash": last_cohort["contentHash"],
        "modelId": MODEL_ID,
        "modelCodeHash": current_model_hash,
        "sourceHash": model_source_hash(),
        "appearanceBlendWeight": BLEND,
        "calibrationId": CALIBRATION_ID,
        "calibrationEvidenceHash": last_cohort[
            "calibrationEvidenceHash"
        ],
        "gate": {
            "minimumComparableCalls": 30,
            "minimumWilson95LowerBound": 0.80,
        },
        "rows": registered_rows,
        "calls": sum(
            row["status"] == "CALL" for row in registered_rows
        ),
        "abstentions": sum(
            row["status"] == "NO_SAFE_CALL"
            for row in registered_rows
        ),
    }
    return hashed(core)


def register_next() -> dict[str, Any]:
    manifest = initialize()
    verify_journal()
    last_entry = manifest["cohorts"][-1]
    last_score_path = HERE / last_entry["scoreFile"]
    if not last_score_path.exists():
        raise RuntimeError(
            "Latest cohort has no score file; run the score command first."
        )
    last_score = read_json(last_score_path)
    verify_hashed(last_score, f"{last_entry['cohortId']} score")
    if last_score["pending"] != 0:
        raise RuntimeError(
            f"Latest cohort still has {last_score['pending']} pending rows; "
            "next-cohort registration is locked."
        )
    last_cohort = read_json(HERE / last_entry["predictionsFile"])
    next_cohort = build_next_cohort(manifest, last_cohort)
    next_path = cohort_prediction_path(next_cohort["cohortId"])
    if next_path.exists():
        raise RuntimeError(f"Refusing to overwrite {next_path.name}")
    write_json(next_path, next_cohort)
    entries = [*manifest["cohorts"], cohort_entry(next_cohort)]
    updated = hashed(
        manifest_core(entries, manifest["createdAt"], utc_now())
    )
    write_json(MANIFEST, updated)
    score_all()
    return next_cohort


def verify_journal() -> dict[str, Any]:
    if not MANIFEST.exists():
        raise RuntimeError("Forward journal has not been initialized")
    manifest = read_json(MANIFEST)
    verify_hashed(manifest, "forward journal")
    previous_hash = None
    seen_ids = set()
    for index, entry in enumerate(manifest["cohorts"], start=1):
        cohort_id = f"cohort-{index:03d}"
        if entry["cohortId"] != cohort_id or cohort_id in seen_ids:
            raise RuntimeError("Cohort identifiers are not contiguous")
        seen_ids.add(cohort_id)
        cohort = read_json(HERE / entry["predictionsFile"])
        verify_hashed(cohort, f"{cohort_id} predictions")
        if cohort["contentHash"] != entry["contentHash"]:
            raise RuntimeError(f"{cohort_id} manifest hash mismatch")
        if cohort["previousCohortContentHash"] != previous_hash:
            raise RuntimeError(f"{cohort_id} hash chain mismatch")
        if len(cohort["rows"]) != 24:
            raise RuntimeError(f"{cohort_id} must contain 24 market-sides")
        keys = {
            (row["market"], row["side"]) for row in cohort["rows"]
        }
        if len(keys) != 24:
            raise RuntimeError(f"{cohort_id} contains duplicate routes")
        for row in cohort["rows"]:
            if row["sourceCutoff"] >= row["targetDate"]:
                raise RuntimeError(f"{cohort_id} has a non-causal cutoff")
        score_path = HERE / entry["scoreFile"]
        if score_path.exists():
            score = read_json(score_path)
            verify_hashed(score, f"{cohort_id} score")
            if score["predictionContentHash"] != cohort["contentHash"]:
                raise RuntimeError(f"{cohort_id} score references wrong hash")
            if score["scored"] + score["pending"] != 24:
                raise RuntimeError(f"{cohort_id} score count mismatch")
        previous_hash = cohort["contentHash"]
    return manifest


def write_report(
    manifest: dict[str, Any], scores: list[dict[str, Any]]
) -> None:
    score_by_id = {score["cohortId"]: score for score in scores}
    scored_rows = sum(score["scored"] for score in scores)
    total_hits = sum(score["hits"] for score in scores)
    pending = sum(score["pending"] for score in scores)
    lines = [
        "# Absent-Digits Prospective Forward Journal",
        "",
        f"Generated: {utc_now()}",
        f"Manifest: `{manifest['contentHash']}`",
        "",
        f"- Cohorts: {len(manifest['cohorts'])}",
        f"- Scored market-sides: {scored_rows}",
        f"- Pending market-sides: {pending}",
        (
            f"- Aggregate strict accuracy: {total_hits / scored_rows * 100:.1f}% "
            f"({total_hits}/{scored_rows})"
            if scored_rows
            else "- Aggregate strict accuracy: pending"
        ),
        "",
        "| Cohort | Targets | Calls | Scored | Hits | Accuracy | Pending | Prediction hash |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for entry in manifest["cohorts"]:
        cohort = read_json(HERE / entry["predictionsFile"])
        score = score_by_id.get(entry["cohortId"])
        accuracy = (
            f"{score['strictAccuracy'] * 100:.1f}%"
            if score and score["strictAccuracy"] is not None
            else "-"
        )
        lines.append(
            f"| {entry['cohortId']} | {', '.join(entry['targets'])} | "
            f"{cohort['calls']} | {score['scored'] if score else 0} | "
            f"{score['hits'] if score else 0} | {accuracy} | "
            f"{score['pending'] if score else 24} | "
            f"`{entry['contentHash']}` |"
        )
    lines.extend(
        [
            "",
            (
                f"Next registration is locked: {pending} target rows are pending."
                if pending
                else "The latest cohort is fully scored; next registration is eligible."
            ),
        ]
    )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def status() -> dict[str, Any]:
    manifest = initialize()
    scores = score_all()
    verify_journal()
    return {
        "status": "verified",
        "manifestHash": manifest["contentHash"],
        "cohorts": len(manifest["cohorts"]),
        "scored": sum(score["scored"] for score in scores),
        "pending": sum(score["pending"] for score in scores),
        "nextRegistrationLocked": scores[-1]["pending"] != 0,
        "latestCohort": manifest["cohorts"][-1]["cohortId"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=("init", "score", "verify", "status", "register-next"),
    )
    args = parser.parse_args()
    if args.command == "init":
        result: Any = initialize()
    elif args.command == "score":
        result = score_all()
    elif args.command == "verify":
        result = verify_journal()
    elif args.command == "register-next":
        result = register_next()
    else:
        result = status()
    if isinstance(result, list):
        summary = {
            "cohorts": len(result),
            "scored": sum(score["scored"] for score in result),
            "pending": sum(score["pending"] for score in result),
        }
    elif args.command in {"init", "verify"}:
        summary = {
            "status": "verified",
            "manifestHash": result["contentHash"],
            "cohorts": len(result["cohorts"]),
        }
    else:
        summary = result
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(
            json.dumps(
                {"status": "locked", "reason": str(error)},
                indent=2,
            )
        )
        raise SystemExit(1) from None
