from __future__ import annotations

import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RESULTS = HERE / "results.json"
REGISTRY = HERE / "FROZEN_FORWARD_REGISTRY.json"
CALIBRATION_REGISTRY = HERE / "FROZEN_CALIBRATION_REGISTRY.json"
CALIBRATION_RESULTS = HERE / "calibration_results.json"
WEIGHTING_RESULTS = HERE / "weighting_ablation_results.json"
FEATURE_RESULTS = HERE / "feature_ablation_results.json"
SELECTIVE_RESULTS = HERE / "selective_gate_results.json"
DYNAMIC_ROUTE_RESULTS = HERE / "dynamic_route_results.json"
BLEND_STABILITY_RESULTS = HERE / "blend_stability_results.json"
FORWARD_JOURNAL = HERE / "FORWARD_JOURNAL.json"
FORWARD_SCORE = HERE / "FORWARD_SCORE.json"
RUNNER = HERE / "run_research.py"
EXTENDED = ROOT / "research" / "panel_top30_v2" / "extended_records.json"
INDEPENDENT = (
    ROOT
    / "research"
    / "panel_top60_prospective_v2"
    / "independent_forward_records.json"
)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def main() -> None:
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    calibration = json.loads(
        CALIBRATION_REGISTRY.read_text(encoding="utf-8")
    )
    calibration_results = json.loads(
        CALIBRATION_RESULTS.read_text(encoding="utf-8")
    )
    weighting_results = json.loads(
        WEIGHTING_RESULTS.read_text(encoding="utf-8")
    )
    feature_results = json.loads(
        FEATURE_RESULTS.read_text(encoding="utf-8")
    )
    selective_results = json.loads(
        SELECTIVE_RESULTS.read_text(encoding="utf-8")
    )
    dynamic_route_results = json.loads(
        DYNAMIC_ROUTE_RESULTS.read_text(encoding="utf-8")
    )
    blend_stability_results = json.loads(
        BLEND_STABILITY_RESULTS.read_text(encoding="utf-8")
    )
    forward_journal = json.loads(
        FORWARD_JOURNAL.read_text(encoding="utf-8")
    )
    code_hash = sha256(RUNNER.read_bytes())
    source_hash = sha256(EXTENDED.read_bytes() + b"\n" + INDEPENDENT.read_bytes())
    assert results["codeHash"] == code_hash
    assert registry["codeHash"] == code_hash
    assert results["sourceHash"] == source_hash
    assert registry["sourceHash"] == source_hash

    core = {
        key: value
        for key, value in registry.items()
        if key not in {"contentHash", "calls", "abstentions"}
    }
    canonical = json.dumps(core, sort_keys=True, separators=(",", ":")).encode()
    assert registry["contentHash"] == sha256(canonical)
    assert len(registry["rows"]) == 24
    assert registry["calls"] + registry["abstentions"] == 24

    calibration_core = {
        key: value
        for key, value in calibration.items()
        if key != "contentHash"
    }
    calibration_canonical = json.dumps(
        calibration_core, sort_keys=True, separators=(",", ":")
    ).encode()
    assert calibration["contentHash"] == sha256(calibration_canonical)
    assert calibration["baseRegistryContentHash"] == registry["contentHash"]
    assert calibration["calibrationId"] == "local-beta-w240-s80-v1"
    assert calibration["method"] == {
        "kind": "local_beta",
        "window": 240,
        "priorMean": 0.506,
        "priorStrength": 80,
    }
    assert calibration_results["promoted"] is True
    assert calibration_results["selectedMethod"] == "local_beta_w240_s80"
    assert len(calibration["rows"]) == 24
    calibration_seen = set()
    for row in calibration["rows"]:
        key = (row["market"], row["side"])
        assert key not in calibration_seen
        calibration_seen.add(key)
        assert 0 < row["calibrationSample"] <= 240
        assert 0 <= row["calibrationHits"] <= row["calibrationSample"]
        expected_confidence = (
            row["calibrationHits"] + 0.506 * 80
        ) / (row["calibrationSample"] + 80)
        assert abs(row["confidence"] - expected_confidence) < 1e-15

    assert weighting_results["baseline"] == "dynamic_eta35_decay097"
    assert weighting_results["promoted"] is False
    assert len(weighting_results["configurations"]) == 6
    for block in (
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ):
        ablation_baseline = weighting_results["metrics"][
            weighting_results["baseline"]
        ][block]
        main_result = results["blocks"][block]
        assert ablation_baseline["rows"] == main_result["rows"]
        assert ablation_baseline["hits"] == main_result["hits"]
        assert (
            abs(
                ablation_baseline["strictAccuracy"]
                - main_result["strictAccuracy"]
            )
            < 1e-15
        )

    assert feature_results["baseline"] == "all_features"
    assert feature_results["promoted"] is False
    assert len(feature_results["configurations"]) == 6
    for block in (
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ):
        feature_baseline = feature_results["metrics"][
            feature_results["baseline"]
        ][block]
        main_result = results["blocks"][block]
        assert feature_baseline["rows"] == main_result["rows"]
        assert feature_baseline["hits"] == main_result["hits"]
        assert (
            abs(
                feature_baseline["strictAccuracy"]
                - main_result["strictAccuracy"]
            )
            < 1e-15
        )

    assert selective_results["runtimePromoted"] is False
    assert selective_results["historical80WilsonGatePassed"] is False
    assert len(selective_results["gateCandidates"]) == 9
    for block in (
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ):
        all_rows = selective_results["allRowsMetrics"][block]
        main_result = results["blocks"][block]
        assert all_rows["rows"] == main_result["rows"]
        assert all_rows["hits"] == main_result["hits"]
        assert (
            abs(all_rows["strictAccuracy"] - main_result["strictAccuracy"])
            < 1e-15
        )

    assert dynamic_route_results["baseline"] == "global_075"
    assert dynamic_route_results["selected"] == "global_075"
    assert dynamic_route_results["promoted"] is False
    assert len(dynamic_route_results["strategies"]) == 7
    for block in (
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ):
        routed_baseline = dynamic_route_results["metrics"][
            dynamic_route_results["baseline"]
        ][block]
        main_result = results["blocks"][block]
        assert routed_baseline["rows"] == main_result["rows"]
        assert routed_baseline["hits"] == main_result["hits"]
        assert (
            abs(
                routed_baseline["strictAccuracy"]
                - main_result["strictAccuracy"]
            )
            < 1e-15
        )

    assert blend_stability_results["selectedBlend"] == 0.75
    assert blend_stability_results["selectionRobust"] is False
    assert blend_stability_results["iterations"] == 6000
    for blend, item in results["validationGrid"].items():
        stability_item = blend_stability_results["validationGrid"][blend]
        assert stability_item["rows"] == item["rows"]
        assert stability_item["hits"] == item["hits"]
        assert (
            abs(
                stability_item["strictAccuracy"]
                - item["strictAccuracy"]
            )
            < 1e-15
        )

    journal_core = {
        key: value
        for key, value in forward_journal.items()
        if key != "contentHash"
    }
    assert forward_journal["contentHash"] == sha256(
        json.dumps(
            journal_core, sort_keys=True, separators=(",", ":")
        ).encode()
    )
    previous_cohort_hash = None
    journal_pending = 0
    for index, entry in enumerate(
        forward_journal["cohorts"], start=1
    ):
        assert entry["cohortId"] == f"cohort-{index:03d}"
        prediction_path = HERE / entry["predictionsFile"]
        cohort = json.loads(prediction_path.read_text(encoding="utf-8"))
        cohort_core = {
            key: value
            for key, value in cohort.items()
            if key != "contentHash"
        }
        assert cohort["contentHash"] == sha256(
            json.dumps(
                cohort_core, sort_keys=True, separators=(",", ":")
            ).encode()
        )
        assert cohort["contentHash"] == entry["contentHash"]
        assert (
            cohort["previousCohortContentHash"]
            == previous_cohort_hash
        )
        assert len(cohort["rows"]) == 24
        assert len(
            {
                (row["market"], row["side"])
                for row in cohort["rows"]
            }
        ) == 24
        assert all(
            row["sourceCutoff"] < row["targetDate"]
            for row in cohort["rows"]
        )
        score_path = HERE / entry["scoreFile"]
        if score_path.exists():
            cohort_score = json.loads(
                score_path.read_text(encoding="utf-8")
            )
            score_core = {
                key: value
                for key, value in cohort_score.items()
                if key != "contentHash"
            }
            assert cohort_score["contentHash"] == sha256(
                json.dumps(
                    score_core,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode()
            )
            assert (
                cohort_score["predictionContentHash"]
                == cohort["contentHash"]
            )
            assert (
                cohort_score["scored"] + cohort_score["pending"]
                == 24
            )
            journal_pending += cohort_score["pending"]
        previous_cohort_hash = cohort["contentHash"]

    seed_entry = forward_journal["cohorts"][0]
    seed_cohort = json.loads(
        (HERE / seed_entry["predictionsFile"]).read_text(
            encoding="utf-8"
        )
    )
    assert seed_cohort["baseRegistryContentHash"] == registry["contentHash"]
    assert (
        seed_cohort["calibrationEvidenceHash"]
        == calibration["contentHash"]
    )
    seed_by_key = {
        (row["market"], row["side"]): row
        for row in seed_cohort["rows"]
    }
    calibration_by_key = {
        (row["market"], row["side"]): row
        for row in calibration["rows"]
    }
    for frozen in registry["rows"]:
        key = (frozen["market"], frozen["side"])
        seed = seed_by_key[key]
        calibrated = calibration_by_key[key]
        assert (
            seed["candidateAvoidDigits"]
            == frozen["candidateAvoidDigits"]
        )
        assert seed["status"] == frozen["status"]
        assert abs(seed["confidence"] - calibrated["confidence"]) < 1e-15

    if FORWARD_SCORE.exists():
        forward_score = json.loads(FORWARD_SCORE.read_text(encoding="utf-8"))
        assert forward_score["registryContentHash"] == registry["contentHash"]
        assert (
            forward_score["calibrationRegistryContentHash"]
            == calibration["contentHash"]
        )
        assert (
            forward_score["calibration"]["id"]
            == calibration["calibrationId"]
        )
        assert (
            forward_score["pending"]
            + forward_score["researchCandidates"]["scored"]
            == 24
        )

    seen = set()
    for row in registry["rows"]:
        key = (row["market"], row["side"])
        assert key not in seen
        seen.add(key)
        assert row["side"] in {"open", "close"}
        assert row["targetDate"] >= "2026-07-25"
        assert row["sourceCutoff"] < row["targetDate"]
        assert len(row["candidateAvoidDigits"]) == 2
        assert len(set(row["candidateAvoidDigits"])) == 2
        assert all(0 <= digit <= 9 for digit in row["candidateAvoidDigits"])
        assert set(row["appearanceProbabilityByDigit"]) == {
            str(value) for value in range(10)
        }
        assert all(
            0 <= value <= 1
            for value in row["appearanceProbabilityByDigit"].values()
        )
        lower = row["wilson95"][0]
        expected_call = lower >= 0.80 and row["reliabilitySample"] >= 30
        assert row["strictCall"] == expected_call
        assert row["status"] == ("CALL" if expected_call else "NO_SAFE_CALL")

    for block in (
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ):
        item = results["blocks"][block]
        assert item["rows"] > 0
        assert 0 <= item["strictAccuracy"] <= 1
        assert item["hits"] <= item["rows"]

    print(
        json.dumps(
            {
                "status": "verified",
                "modelId": registry["modelId"],
                "codeHash": code_hash,
                "sourceHash": source_hash,
                "registryHash": registry["contentHash"],
                "calibrationId": calibration["calibrationId"],
                "calibrationRegistryHash": calibration["contentHash"],
                "weightingRegime": weighting_results["baseline"],
                "weightingChangePromoted": weighting_results["promoted"],
                "featureSet": feature_results["baseline"],
                "featureChangePromoted": feature_results["promoted"],
                "selectiveGate": selective_results["selectedGate"]["name"],
                "selectiveGatePromoted": selective_results[
                    "runtimePromoted"
                ],
                "familyBlendRouter": dynamic_route_results["selected"],
                "familyBlendRoutingPromoted": dynamic_route_results[
                    "promoted"
                ],
                "familyBlendSelectionRobust": blend_stability_results[
                    "selectionRobust"
                ],
                "forwardJournalHash": forward_journal["contentHash"],
                "forwardCohorts": len(forward_journal["cohorts"]),
                "forwardPending": journal_pending,
                "calls": registry["calls"],
                "abstentions": registry["abstentions"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
