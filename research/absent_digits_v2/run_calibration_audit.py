from __future__ import annotations

import json
import hashlib
import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from random import Random
from typing import Any

from run_research import (
    RANDOM_PAIR_BASE,
    accuracy,
    load_rows,
    run_series,
    select_blend,
    wilson,
)


HERE = Path(__file__).resolve().parent
BASE_REGISTRY = HERE / "FROZEN_FORWARD_REGISTRY.json"
CALIBRATION_REGISTRY = HERE / "FROZEN_CALIBRATION_REGISTRY.json"
CALIBRATION_ID = "local-beta-w240-s80-v1"
CURRENT_METHOD = "local_beta_w120_s10"
LOCAL_WINDOWS = (30, 60, 120, 240)
LOCAL_STRENGTHS = (5, 10, 20, 40, 80)
HIERARCHICAL_WINDOWS = (60, 120, 240)
HIERARCHICAL_STRENGTHS = (10, 30, 60)
EWMA_DECAYS = (0.90, 0.95, 0.97, 0.99)
EWMA_PRIOR_WEIGHTS = (2, 10, 30)
GLOBAL_WINDOWS = (720, 1440)
EPSILON = 1e-9


def clip_probability(value: float) -> float:
    return max(EPSILON, min(1 - EPSILON, value))


def beta_mean(
    values: list[bool],
    prior: float,
    strength: float,
    window: int | None = None,
) -> float:
    selected = values[-window:] if window else values
    return (sum(selected) + prior * strength) / (len(selected) + strength)


def ewma_mean(
    values: list[bool], decay: float, prior_weight: float
) -> float:
    selected = values[-480:]
    weighted_hits = 0.0
    total_weight = 0.0
    for age, hit in enumerate(reversed(selected)):
        weight = decay**age
        weighted_hits += weight * int(hit)
        total_weight += weight
    return (
        weighted_hits + RANDOM_PAIR_BASE * prior_weight
    ) / (total_weight + prior_weight)


def candidate_probabilities(
    local_history: list[bool], global_history: list[bool]
) -> dict[str, float]:
    output = {"constant_base": RANDOM_PAIR_BASE}
    for window in GLOBAL_WINDOWS:
        output[f"global_beta_w{window}_s30"] = beta_mean(
            global_history, RANDOM_PAIR_BASE, 30, window
        )
    for window in LOCAL_WINDOWS:
        for strength in LOCAL_STRENGTHS:
            output[f"local_beta_w{window}_s{strength}"] = beta_mean(
                local_history, RANDOM_PAIR_BASE, strength, window
            )
    for decay in EWMA_DECAYS:
        decay_name = str(decay).replace(".", "")
        for prior_weight in EWMA_PRIOR_WEIGHTS:
            output[f"local_ewma_d{decay_name}_s{prior_weight}"] = ewma_mean(
                local_history, decay, prior_weight
            )
    for window in HIERARCHICAL_WINDOWS:
        global_prior = beta_mean(
            global_history, RANDOM_PAIR_BASE, 30, 1440
        )
        for strength in HIERARCHICAL_STRENGTHS:
            output[f"hier_beta_w{window}_s{strength}"] = beta_mean(
                local_history, global_prior, strength, window
            )
    return output


def build_prequential_ledger() -> tuple[list[dict[str, Any]], float]:
    rows_by_market, _ = load_rows()
    raw: list[dict[str, Any]] = []
    for market, market_rows in rows_by_market.items():
        for side in ("open", "close"):
            raw.extend(run_series(market, side, market_rows))
    selected_blend, _ = select_blend(raw)
    blend_key = str(selected_blend)

    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in raw:
        by_date[row["date"]].append(row)

    local_histories: dict[str, list[bool]] = defaultdict(list)
    global_history: list[bool] = []
    ledger: list[dict[str, Any]] = []
    for target_date in sorted(by_date):
        pending: list[tuple[str, bool]] = []
        for row in sorted(
            by_date[target_date],
            key=lambda item: (item["market"], item["side"]),
        ):
            route = f"{row['market']}|{row['side']}"
            hit = bool(row["blendHits"][blend_key])
            if row["block"] != "warmup":
                probabilities = candidate_probabilities(
                    local_histories[route], global_history
                )
                ledger.append(
                    {
                        "date": target_date,
                        "market": row["market"],
                        "side": row["side"],
                        "block": row["block"],
                        "hit": hit,
                        "familyAgreement": bool(row["familyAgreement"]),
                        "randomReference": float(row["randomReference"]),
                        "probabilities": probabilities,
                    }
                )
            pending.append((route, hit))

        # Same-date outcomes are never allowed to inform one another.
        for route, hit in pending:
            local_histories[route].append(hit)
            global_history.append(hit)
    return ledger, selected_blend


def auc(probabilities: list[float], outcomes: list[bool]) -> float:
    positives = sum(outcomes)
    negatives = len(outcomes) - positives
    if not positives or not negatives:
        return 0.5
    ranked = sorted(zip(probabilities, outcomes), key=lambda item: item[0])
    positive_rank_sum = 0.0
    index = 0
    while index < len(ranked):
        end = index + 1
        while end < len(ranked) and ranked[end][0] == ranked[index][0]:
            end += 1
        average_rank = ((index + 1) + end) / 2
        positive_rank_sum += average_rank * sum(
            int(hit) for _, hit in ranked[index:end]
        )
        index = end
    return (
        positive_rank_sum - positives * (positives + 1) / 2
    ) / (positives * negatives)


def calibration_bins(
    probabilities: list[float], outcomes: list[bool]
) -> tuple[list[dict[str, Any]], float]:
    bins: list[dict[str, Any]] = []
    total = len(outcomes)
    ece = 0.0
    for lower_index in range(20):
        lower = lower_index / 20
        upper = (lower_index + 1) / 20
        indices = [
            index
            for index, value in enumerate(probabilities)
            if lower <= value < upper or (upper == 1 and value == 1)
        ]
        if not indices:
            continue
        predicted = sum(probabilities[index] for index in indices) / len(indices)
        observed = sum(outcomes[index] for index in indices) / len(indices)
        ece += len(indices) / total * abs(predicted - observed)
        bins.append(
            {
                "lower": lower,
                "upper": upper,
                "rows": len(indices),
                "meanPredicted": predicted,
                "observedRate": observed,
            }
        )
    return bins, ece


def method_metrics(
    rows: list[dict[str, Any]], method: str
) -> dict[str, Any]:
    probabilities = [
        clip_probability(row["probabilities"][method]) for row in rows
    ]
    outcomes = [bool(row["hit"]) for row in rows]
    observed_rate = accuracy(outcomes)
    mean_predicted = sum(probabilities) / len(probabilities)
    brier = sum(
        (probability - int(outcome)) ** 2
        for probability, outcome in zip(probabilities, outcomes)
    ) / len(rows)
    log_loss = -sum(
        int(outcome) * math.log(probability)
        + (1 - int(outcome)) * math.log(1 - probability)
        for probability, outcome in zip(probabilities, outcomes)
    ) / len(rows)
    bins, ece = calibration_bins(probabilities, outcomes)

    ranked = sorted(
        range(len(rows)),
        key=lambda index: probabilities[index],
        reverse=True,
    )
    top_count = max(1, math.ceil(len(rows) * 0.20))
    top_indices = ranked[:top_count]
    top_hits = sum(outcomes[index] for index in top_indices)
    top_lower, top_upper = wilson(top_hits, top_count)
    return {
        "rows": len(rows),
        "hits": sum(outcomes),
        "observedRate": observed_rate,
        "meanPredicted": mean_predicted,
        "calibrationBias": mean_predicted - observed_rate,
        "brier": brier,
        "logLoss": log_loss,
        "ece": ece,
        "auc": auc(probabilities, outcomes),
        "minPredicted": min(probabilities),
        "maxPredicted": max(probabilities),
        "topQuintile": {
            "rows": top_count,
            "hits": top_hits,
            "accuracy": top_hits / top_count,
            "wilson95": [top_lower, top_upper],
        },
        "bins": bins,
    }


def paired_brier_bootstrap(
    rows: list[dict[str, Any]],
    candidate: str,
    comparator: str,
    iterations: int = 4000,
) -> dict[str, Any]:
    weekly: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        iso_year, iso_week, _ = datetime.fromisoformat(row["date"]).isocalendar()
        group = f"{iso_year}-W{iso_week:02d}"
        outcome = int(bool(row["hit"]))
        candidate_loss = (
            row["probabilities"][candidate] - outcome
        ) ** 2
        comparator_loss = (
            row["probabilities"][comparator] - outcome
        ) ** 2
        weekly[group].append(candidate_loss - comparator_loss)

    clusters = list(weekly.values())
    observed = sum(sum(cluster) for cluster in clusters) / sum(
        len(cluster) for cluster in clusters
    )
    random = Random(20260724)
    bootstrap = []
    for _ in range(iterations):
        sampled = [random.choice(clusters) for _ in clusters]
        bootstrap.append(
            sum(sum(cluster) for cluster in sampled)
            / sum(len(cluster) for cluster in sampled)
        )
    bootstrap.sort()
    lower = bootstrap[int(iterations * 0.025)]
    upper = bootstrap[min(iterations - 1, int(iterations * 0.975))]
    improvement_probability = sum(value < 0 for value in bootstrap) / iterations
    return {
        "candidateMinusComparator": observed,
        "clusterBootstrap95": [lower, upper],
        "probabilityCandidateImproves": improvement_probability,
        "weekClusters": len(clusters),
    }


def build_calibration_registry(
    selected_blend: float,
    generated_at: str,
    selection_evidence: dict[str, Any],
) -> dict[str, Any]:
    rows_by_market, _ = load_rows()
    base_registry = json.loads(BASE_REGISTRY.read_text(encoding="utf-8"))
    blend_key = str(selected_blend)
    calibrated_rows = []
    for frozen in base_registry["rows"]:
        target_date = date.fromisoformat(frozen["targetDate"])
        cutoff = (target_date - timedelta(days=729)).isoformat()
        historical = [
            row
            for row in rows_by_market[frozen["market"]]
            if cutoff <= row["isoDate"] <= frozen["sourceCutoff"]
        ]
        placeholder = {
            "market": frozen["market"],
            "isoDate": frozen["targetDate"],
            "day": target_date.strftime("%A"),
            "openPanel": "000",
            "closePanel": "000",
            "source": "unobserved_target_placeholder",
        }
        series = run_series(
            frozen["market"], frozen["side"], historical + [placeholder]
        )
        prior_forecasts = series[:-1][-240:]
        hits = sum(
            bool(row["blendHits"][blend_key]) for row in prior_forecasts
        )
        sample = len(prior_forecasts)
        calibrated_rows.append(
            {
                "market": frozen["market"],
                "side": frozen["side"],
                "targetDate": frozen["targetDate"],
                "sourceCutoff": frozen["sourceCutoff"],
                "confidence": (
                    hits + RANDOM_PAIR_BASE * 80
                ) / (sample + 80),
                "calibrationHits": hits,
                "calibrationSample": sample,
            }
        )
    core = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "purpose": (
            "Hash-frozen calibrated point-confidence addendum for the immutable "
            "absent-digits forward registry. It does not change pairs or calls."
        ),
        "baseRegistryContentHash": base_registry["contentHash"],
        "calibrationId": CALIBRATION_ID,
        "method": {
            "kind": "local_beta",
            "window": 240,
            "priorMean": RANDOM_PAIR_BASE,
            "priorStrength": 80,
        },
        "selectionEvidence": selection_evidence,
        "rows": calibrated_rows,
    }
    canonical = json.dumps(
        core, sort_keys=True, separators=(",", ":")
    ).encode()
    return {
        **core,
        "contentHash": hashlib.sha256(canonical).hexdigest(),
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def decimal(value: float) -> str:
    return f"{value:.4f}"


def main() -> None:
    ledger, selected_blend = build_prequential_ledger()
    methods = sorted(ledger[0]["probabilities"])
    block_names = [
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ]
    by_block = {
        block: [row for row in ledger if row["block"] == block]
        for block in block_names
    }
    metrics = {
        block: {
            method: method_metrics(rows, method)
            for method in methods
        }
        for block, rows in by_block.items()
    }
    selected = min(
        methods,
        key=lambda method: (
            metrics["validation"][method]["brier"],
            metrics["validation"][method]["logLoss"],
            method != CURRENT_METHOD,
        ),
    )
    confirmation_rows = by_block["holdout"] + by_block["recent"]
    confirmation = {
        "selected": method_metrics(confirmation_rows, selected),
        "current": method_metrics(confirmation_rows, CURRENT_METHOD),
        "pairedBrier": paired_brier_bootstrap(
            confirmation_rows, selected, CURRENT_METHOD
        ),
    }
    later_rows = (
        by_block["post_cache"] + by_block["independent_extension"]
    )
    later = {
        "selected": method_metrics(later_rows, selected),
        "current": method_metrics(later_rows, CURRENT_METHOD),
        "pairedBrier": paired_brier_bootstrap(
            later_rows, selected, CURRENT_METHOD
        ),
    }
    validation_better = (
        metrics["validation"][selected]["brier"]
        < metrics["validation"][CURRENT_METHOD]["brier"]
    )
    confirmation_persistent = (
        metrics["holdout"][selected]["brier"]
        <= metrics["holdout"][CURRENT_METHOD]["brier"]
        and metrics["recent"][selected]["brier"]
        <= metrics["recent"][CURRENT_METHOD]["brier"]
        and confirmation["pairedBrier"]["clusterBootstrap95"][1] < 0
    )
    later_non_degrading = (
        later["selected"]["brier"] <= later["current"]["brier"]
    )
    promoted = (
        selected != CURRENT_METHOD
        and validation_better
        and confirmation_persistent
        and later_non_degrading
    )

    generated_at = datetime.now(timezone.utc).isoformat()
    output = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "purpose": (
            "Strictly prequential confidence calibration audit. All confidence "
            "features use only earlier dates; same-date outcomes are batch-updated."
        ),
        "selectedBlendAppearanceWeight": selected_blend,
        "currentMethod": CURRENT_METHOD,
        "candidateCount": len(methods),
        "selectionBlock": "validation",
        "selectedMethod": selected,
        "promotionCriteria": {
            "validationBrierImproves": validation_better,
            "holdoutAndRecentBrierNonDegradingWithConfirmationBootstrapBelowZero": (
                confirmation_persistent
            ),
            "postCacheAndIndependentCombinedNonDegrading": later_non_degrading,
        },
        "promoted": promoted,
        "blocks": metrics,
        "confirmation": confirmation,
        "laterExtension": later,
    }
    (HERE / "calibration_results.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )
    calibration_registry = build_calibration_registry(
        selected_blend,
        generated_at,
        {
            "selectedMethod": selected,
            "promoted": promoted,
            "validationBrier": metrics["validation"][selected]["brier"],
            "currentValidationBrier": metrics["validation"][CURRENT_METHOD][
                "brier"
            ],
            "confirmationBrierDelta": confirmation["pairedBrier"][
                "candidateMinusComparator"
            ],
            "confirmationBootstrap95": confirmation["pairedBrier"][
                "clusterBootstrap95"
            ],
            "laterBrierDelta": later["pairedBrier"][
                "candidateMinusComparator"
            ],
        },
    )
    if not promoted:
        raise RuntimeError(
            "Calibration addendum cannot be frozen without promotion evidence"
        )
    CALIBRATION_REGISTRY.write_text(
        json.dumps(calibration_registry, indent=2) + "\n",
        encoding="utf-8",
    )

    status = "Promoted" if promoted else "Rejected"
    lines = [
        "# Confidence Calibration Audit",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        "## Decision",
        "",
        f"**{status}.** Validation selected `{selected}` from "
        f"{len(methods)} strictly causal reliability estimators. The runtime "
        f"currently uses `{CURRENT_METHOD}`.",
        "",
        "A candidate is promoted only if it improves validation Brier loss, "
        "does not regress on either Holdout or Recent, has a week-clustered "
        "95% bootstrap interval below zero on their combined Brier difference, "
        "and does not regress on the later Post-cache + Independent extension.",
        "",
        "## Chronological calibration",
        "",
        "| Block | Method | N | Observed | Mean predicted | Brier | Log loss | ECE | AUC | Top 20% | Top 20% 95% lower |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for block in block_names:
        for method in dict.fromkeys((selected, CURRENT_METHOD)):
            item = metrics[block][method]
            top = item["topQuintile"]
            lines.append(
                f"| {block.replace('_', ' ').title()} | `{method}` | "
                f"{item['rows']} | {pct(item['observedRate'])} | "
                f"{pct(item['meanPredicted'])} | {decimal(item['brier'])} | "
                f"{decimal(item['logLoss'])} | {pct(item['ece'])} | "
                f"{decimal(item['auc'])} | {pct(top['accuracy'])} | "
                f"{pct(top['wilson95'][0])} |"
            )
    lines.extend(
        [
            "",
            "## Paired Brier confirmation",
            "",
            "| Evidence block | Candidate minus current | Week-clustered 95% interval | P(candidate improves) |",
            "| --- | ---: | ---: | ---: |",
            (
                f"| Holdout + Recent | "
                f"{confirmation['pairedBrier']['candidateMinusComparator']:.5f} | "
                f"[{confirmation['pairedBrier']['clusterBootstrap95'][0]:.5f}, "
                f"{confirmation['pairedBrier']['clusterBootstrap95'][1]:.5f}] | "
                f"{pct(confirmation['pairedBrier']['probabilityCandidateImproves'])} |"
            ),
            (
                f"| Post-cache + Independent extension | "
                f"{later['pairedBrier']['candidateMinusComparator']:.5f} | "
                f"[{later['pairedBrier']['clusterBootstrap95'][0]:.5f}, "
                f"{later['pairedBrier']['clusterBootstrap95'][1]:.5f}] | "
                f"{pct(later['pairedBrier']['probabilityCandidateImproves'])} |"
            ),
            "",
            "## Interpretation",
            "",
            "- Brier and log loss test probability quality; AUC tests whether "
            "confidence ranks hits above misses.",
            "- The top-quintile Wilson lower bound prevents a small high-score "
            "pocket from being mistaken for a safe call.",
            "- The 80% action gate remains based on prequential Wilson evidence, "
            "not on the point confidence estimate.",
        ]
    )
    (HERE / "CALIBRATION_REPORT.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "status": status.lower(),
                "selected": selected,
                "current": CURRENT_METHOD,
                "promoted": promoted,
                "confirmationBrierDelta": confirmation["pairedBrier"][
                    "candidateMinusComparator"
                ],
                "confirmationBootstrap95": confirmation["pairedBrier"][
                    "clusterBootstrap95"
                ],
                "laterBrierDelta": later["pairedBrier"][
                    "candidateMinusComparator"
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
