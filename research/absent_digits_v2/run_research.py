from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
EXTENDED = ROOT / "research" / "panel_top30_v2" / "extended_records.json"
INDEPENDENT = (
    ROOT
    / "research"
    / "panel_top60_prospective_v2"
    / "independent_forward_records.json"
)

MARKETS = [
    "Sridevi",
    "Time Bazar",
    "Madhur Day",
    "Milan Day",
    "Rajdhani Day",
    "Kalyan",
    "Sridevi Night",
    "Kalyan Night",
    "Madhur Night",
    "Milan Night",
    "Rajdhani Night",
    "Main Bazar",
]
DIGITS = list(range(10))
PAIRS = [(a, b) for a in DIGITS for b in DIGITS if a < b]
DAY_OFFSETS = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}
BLENDS = [0.0, 0.25, 0.5, 0.75, 1.0]
MIN_HISTORY = 180
EMA_DECAY = 0.97
WEIGHT_ETA = 35.0
PRIOR_STRENGTH = 12.0
RANDOM_PAIR_BASE = 0.506


def parse_date(value: str) -> date | None:
    parts = str(value or "").replace("-", "/").split("/")
    if len(parts) != 3:
        return None
    try:
        day, month, raw_year = [int(part) for part in parts]
        year = raw_year + 2000 if raw_year < 100 else raw_year
        return date(year, month, day)
    except (TypeError, ValueError):
        return None


def record_iso(record: dict[str, Any]) -> str | None:
    if record.get("isoDate"):
        return str(record["isoDate"])[:10]
    start = parse_date(str(record.get("dateRangeStart", "")))
    if start is None:
        return None
    return (start + timedelta(days=DAY_OFFSETS.get(record.get("day"), 0))).isoformat()


def legal_panel(value: Any) -> bool:
    text = str(value or "")
    return len(text) == 3 and text.isdigit()


def mask_for(panel: Any) -> int:
    mask = 0
    for value in str(panel or ""):
        if value.isdigit():
            mask |= 1 << int(value)
    return mask


def panel_for(row: dict[str, Any], side: str) -> str:
    return str(row["openPanel"] if side == "open" else row["closePanel"])


def load_rows() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    extended_payload = json.loads(EXTENDED.read_text(encoding="utf-8"))
    independent_payload = json.loads(INDEPENDENT.read_text(encoding="utf-8"))
    combined: dict[str, dict[str, dict[str, Any]]] = {
        market: {} for market in MARKETS
    }

    for market in MARKETS:
        for record in extended_payload["extended"].get(market, []):
            iso = record_iso(record)
            if (
                iso
                and legal_panel(record.get("openPanel"))
                and legal_panel(record.get("closePanel"))
            ):
                combined[market][iso] = {**record, "isoDate": iso, "source": "primary"}

        audit = independent_payload["audit"].get(market, {})
        if audit.get("identityAccepted"):
            for record in independent_payload["forward"].get(market, []):
                iso = record_iso(record)
                if (
                    iso
                    and legal_panel(record.get("openPanel"))
                    and legal_panel(record.get("closePanel"))
                ):
                    combined[market][iso] = {
                        **record,
                        "isoDate": iso,
                        "source": "independent",
                    }

    rows = {
        market: sorted(values.values(), key=lambda row: row["isoDate"])
        for market, values in combined.items()
    }
    source_meta = {
        "extendedGeneratedAt": extended_payload.get("generatedAt"),
        "independentGeneratedAt": independent_payload.get("generatedAt"),
        "counts": {market: len(values) for market, values in rows.items()},
        "latest": {
            market: values[-1]["isoDate"] if values else None
            for market, values in rows.items()
        },
    }
    return rows, source_meta


def beta_rate(hits: float, total: int, prior: float, strength: float) -> float:
    return (hits + prior * strength) / (total + strength)


def window_indices(index: int, lookback: int) -> range:
    return range(max(0, index - lookback), index)


def digit_rates(
    masks: list[int],
    indices: Iterable[int],
    priors: list[float],
    strength: float = PRIOR_STRENGTH,
) -> list[float]:
    selected = list(indices)
    total = len(selected)
    hits = [0] * 10
    for idx in selected:
        mask = masks[idx]
        for digit in DIGITS:
            hits[digit] += int(bool(mask & (1 << digit)))
    return [
        beta_rate(hits[digit], total, priors[digit], strength)
        for digit in DIGITS
    ]


def pair_rates(
    masks: list[int],
    indices: Iterable[int],
    prior: float = RANDOM_PAIR_BASE,
    strength: float = PRIOR_STRENGTH,
) -> list[float]:
    selected = list(indices)
    total = len(selected)
    hits = [0] * len(PAIRS)
    for idx in selected:
        mask = masks[idx]
        for pair_index, (a, b) in enumerate(PAIRS):
            hits[pair_index] += int(
                not (mask & (1 << a)) and not (mask & (1 << b))
            )
    return [
        beta_rate(value, total, prior, strength)
        for value in hits
    ]


def normalize_weights(losses: dict[str, float]) -> dict[str, float]:
    best = min(losses.values())
    raw = {
        name: math.exp(-WEIGHT_ETA * (loss - best))
        for name, loss in losses.items()
    }
    total = sum(raw.values())
    return {name: value / total for name, value in raw.items()}


def weighted_vectors(
    predictions: dict[str, list[float]], weights: dict[str, float]
) -> list[float]:
    length = len(next(iter(predictions.values())))
    return [
        sum(weights[name] * values[index] for name, values in predictions.items())
        for index in range(length)
    ]


def digit_brier(probabilities: list[float], mask: int) -> float:
    return sum(
        (probabilities[digit] - int(bool(mask & (1 << digit)))) ** 2
        for digit in DIGITS
    ) / len(DIGITS)


def pair_brier(probabilities: list[float], mask: int) -> float:
    return sum(
        (
            probabilities[index]
            - int(not (mask & (1 << a)) and not (mask & (1 << b)))
        )
        ** 2
        for index, (a, b) in enumerate(PAIRS)
    ) / len(PAIRS)


def pair_hit(pair_index: int, mask: int) -> bool:
    a, b = PAIRS[pair_index]
    return not (mask & (1 << a)) and not (mask & (1 << b))


def absent_digit_count(pair_index: int, mask: int) -> int:
    a, b = PAIRS[pair_index]
    return int(not (mask & (1 << a))) + int(not (mask & (1 << b)))


def observed_random_rate(mask: int) -> float:
    absent = 10 - mask.bit_count()
    return (absent * (absent - 1) / 2) / len(PAIRS)


def wilson(successes: int, total: int, z: float = 1.959963984540054) -> tuple[float, float]:
    if total <= 0:
        return (0.0, 1.0)
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    margin = (
        z
        * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total)
        / denominator
    )
    return max(0.0, center - margin), min(1.0, center + margin)


def exact_sign_pvalue(a_only: int, b_only: int) -> float:
    discordant = a_only + b_only
    if discordant == 0:
        return 1.0
    tail = min(a_only, b_only)
    probability = sum(
        math.comb(discordant, value) for value in range(tail + 1)
    ) / (2**discordant)
    return min(1.0, probability * 2)


def block_for(iso: str) -> str:
    if iso <= "2025-07-13":
        return "warmup"
    if iso <= "2025-11-12":
        return "validation"
    if iso <= "2026-03-14":
        return "holdout"
    if iso <= "2026-07-05":
        return "recent"
    if iso <= "2026-07-19":
        return "post_cache"
    return "independent_extension"


@dataclass
class EmaLoss:
    values: dict[str, float]

    def update(self, losses: dict[str, float]) -> None:
        for name, value in losses.items():
            previous = self.values[name]
            self.values[name] = EMA_DECAY * previous + (1 - EMA_DECAY) * value


def appearance_experts(
    rows: list[dict[str, Any]], masks: list[int], index: int
) -> dict[str, list[float]]:
    long_indices = list(window_indices(index, 730))
    base = digit_rates(
        masks,
        long_indices,
        [0.27] * 10,
        strength=30,
    )
    weekday = rows[index].get("day")
    weekday_indices = [
        idx for idx in long_indices if rows[idx].get("day") == weekday
    ]
    previous_mask = masks[index - 1]
    state_indices = [
        idx
        for idx in long_indices
        if idx > 0 and masks[idx - 1].bit_count() == previous_mask.bit_count()
    ]
    return {
        "appearance_long": base,
        "appearance_30": digit_rates(masks, window_indices(index, 30), base),
        "appearance_90": digit_rates(masks, window_indices(index, 90), base),
        "appearance_weekday": digit_rates(
            masks, weekday_indices, base, strength=18
        ),
        "appearance_prev_kind": digit_rates(
            masks, state_indices, base, strength=20
        ),
    }


def absence_experts(
    rows: list[dict[str, Any]], masks: list[int], index: int
) -> dict[str, list[float]]:
    long_indices = list(window_indices(index, 730))
    weekday = rows[index].get("day")
    weekday_indices = [
        idx for idx in long_indices if rows[idx].get("day") == weekday
    ]
    previous_mask = masks[index - 1]
    transition_indices: list[list[int]] = [[] for _ in PAIRS]
    for historical_index in long_indices:
        if historical_index == 0:
            continue
        historical_previous = masks[historical_index - 1]
        for pair_index, (a, b) in enumerate(PAIRS):
            pair_mask = (1 << a) | (1 << b)
            current_state = int((previous_mask & pair_mask) == 0)
            historical_state = int((historical_previous & pair_mask) == 0)
            if current_state == historical_state:
                transition_indices[pair_index].append(historical_index)

    transition = []
    for pair_index, indices in enumerate(transition_indices):
        a, b = PAIRS[pair_index]
        hits = sum(
            int(not (masks[idx] & (1 << a)) and not (masks[idx] & (1 << b)))
            for idx in indices
        )
        transition.append(
            beta_rate(hits, len(indices), RANDOM_PAIR_BASE, strength=20)
        )

    return {
        "absence_long": pair_rates(masks, long_indices, strength=30),
        "absence_30": pair_rates(masks, window_indices(index, 30)),
        "absence_90": pair_rates(masks, window_indices(index, 90)),
        "absence_weekday": pair_rates(
            masks, weekday_indices, strength=18
        ),
        "absence_transition": transition,
    }


def run_series(
    market: str, side: str, rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    masks = [mask_for(panel_for(row, side)) for row in rows]
    row_count = len(rows)
    digit_matrix = np.zeros((row_count, len(DIGITS)), dtype=np.int8)
    pair_matrix = np.zeros((row_count, len(PAIRS)), dtype=np.int8)
    for row_index, mask in enumerate(masks):
        for digit in DIGITS:
            digit_matrix[row_index, digit] = int(bool(mask & (1 << digit)))
        for pair_index, (a, b) in enumerate(PAIRS):
            pair_matrix[row_index, pair_index] = int(
                not (mask & (1 << a)) and not (mask & (1 << b))
            )

    digit_prefix = np.vstack(
        [np.zeros((1, len(DIGITS)), dtype=np.int32), digit_matrix.cumsum(axis=0)]
    )
    pair_prefix = np.vstack(
        [np.zeros((1, len(PAIRS)), dtype=np.int32), pair_matrix.cumsum(axis=0)]
    )
    day_codes = np.array(
        [DAY_OFFSETS.get(str(row.get("day")), 0) for row in rows],
        dtype=np.int8,
    )
    weekday_digit_prefix = []
    weekday_pair_prefix = []
    weekday_count_prefix = []
    for day_code in range(7):
        selected = (day_codes == day_code).astype(np.int8)
        weekday_count_prefix.append(
            np.concatenate([[0], selected.cumsum(dtype=np.int32)])
        )
        weekday_digit_prefix.append(
            np.vstack(
                [
                    np.zeros((1, len(DIGITS)), dtype=np.int32),
                    (digit_matrix * selected[:, None]).cumsum(axis=0),
                ]
            )
        )
        weekday_pair_prefix.append(
            np.vstack(
                [
                    np.zeros((1, len(PAIRS)), dtype=np.int32),
                    (pair_matrix * selected[:, None]).cumsum(axis=0),
                ]
            )
        )

    previous_kind = np.zeros(row_count, dtype=np.int8)
    for row_index in range(1, row_count):
        unique = masks[row_index - 1].bit_count()
        previous_kind[row_index] = 0 if unique == 1 else 1 if unique == 2 else 2
    kind_digit_prefix = []
    kind_count_prefix = []
    for kind_code in range(3):
        selected = (previous_kind == kind_code).astype(np.int8)
        kind_count_prefix.append(
            np.concatenate([[0], selected.cumsum(dtype=np.int32)])
        )
        kind_digit_prefix.append(
            np.vstack(
                [
                    np.zeros((1, len(DIGITS)), dtype=np.int32),
                    (digit_matrix * selected[:, None]).cumsum(axis=0),
                ]
            )
        )

    previous_pair_absent = np.zeros_like(pair_matrix)
    previous_pair_absent[1:] = pair_matrix[:-1]
    previous_absent_prefix = np.vstack(
        [
            np.zeros((1, len(PAIRS)), dtype=np.int32),
            previous_pair_absent.cumsum(axis=0),
        ]
    )
    previous_absent_hit_prefix = np.vstack(
        [
            np.zeros((1, len(PAIRS)), dtype=np.int32),
            (previous_pair_absent * pair_matrix).cumsum(axis=0),
        ]
    )

    def smoothed(
        prefix: np.ndarray,
        start: int,
        end: int,
        prior: float | np.ndarray,
        strength: float,
        total: int | np.ndarray | None = None,
    ) -> np.ndarray:
        count = prefix[end] - prefix[start]
        denominator = end - start if total is None else total
        return (count + np.asarray(prior) * strength) / (
            np.asarray(denominator) + strength
        )

    def fast_experts(
        index: int,
    ) -> tuple[dict[str, list[float]], dict[str, list[float]]]:
        long_start = max(0, index - 730)
        base = smoothed(
            digit_prefix, long_start, index, np.full(10, 0.27), 30
        )
        day_code = int(day_codes[index])
        weekday_total = (
            weekday_count_prefix[day_code][index]
            - weekday_count_prefix[day_code][long_start]
        )
        weekday_digit_count = (
            weekday_digit_prefix[day_code][index]
            - weekday_digit_prefix[day_code][long_start]
        )
        weekday_pair_count = (
            weekday_pair_prefix[day_code][index]
            - weekday_pair_prefix[day_code][long_start]
        )
        weekday_digits = (
            weekday_digit_count + base * 18
        ) / (weekday_total + 18)
        weekday_pairs = (
            weekday_pair_count + RANDOM_PAIR_BASE * 18
        ) / (weekday_total + 18)

        kind_code = int(previous_kind[index])
        kind_total = (
            kind_count_prefix[kind_code][index]
            - kind_count_prefix[kind_code][long_start]
        )
        kind_count = (
            kind_digit_prefix[kind_code][index]
            - kind_digit_prefix[kind_code][long_start]
        )
        kind_digits = (kind_count + base * 20) / (kind_total + 20)

        appearance = {
            "appearance_long": base.tolist(),
            "appearance_30": smoothed(
                digit_prefix, max(0, index - 30), index, base, 12
            ).tolist(),
            "appearance_90": smoothed(
                digit_prefix, max(0, index - 90), index, base, 12
            ).tolist(),
            "appearance_weekday": weekday_digits.tolist(),
            "appearance_prev_kind": kind_digits.tolist(),
        }

        long_pairs = smoothed(
            pair_prefix, long_start, index, RANDOM_PAIR_BASE, 30
        )
        previous_state = previous_pair_absent[index].astype(bool)
        state_one_total = (
            previous_absent_prefix[index]
            - previous_absent_prefix[long_start]
        )
        state_one_hits = (
            previous_absent_hit_prefix[index]
            - previous_absent_hit_prefix[long_start]
        )
        all_hits = pair_prefix[index] - pair_prefix[long_start]
        window_total = index - long_start
        transition_total = np.where(
            previous_state, state_one_total, window_total - state_one_total
        )
        transition_hits = np.where(
            previous_state, state_one_hits, all_hits - state_one_hits
        )
        transition = (
            transition_hits + RANDOM_PAIR_BASE * 20
        ) / (transition_total + 20)
        absence = {
            "absence_long": long_pairs.tolist(),
            "absence_30": smoothed(
                pair_prefix,
                max(0, index - 30),
                index,
                RANDOM_PAIR_BASE,
                12,
            ).tolist(),
            "absence_90": smoothed(
                pair_prefix,
                max(0, index - 90),
                index,
                RANDOM_PAIR_BASE,
                12,
            ).tolist(),
            "absence_weekday": weekday_pairs.tolist(),
            "absence_transition": transition.tolist(),
        }
        return appearance, absence

    appearance_loss = EmaLoss(
        {
            "appearance_long": 0.20,
            "appearance_30": 0.20,
            "appearance_90": 0.20,
            "appearance_weekday": 0.20,
            "appearance_prev_kind": 0.20,
        }
    )
    absence_loss = EmaLoss(
        {
            "absence_long": 0.25,
            "absence_30": 0.25,
            "absence_90": 0.25,
            "absence_weekday": 0.25,
            "absence_transition": 0.25,
        }
    )
    output = []

    for index in range(MIN_HISTORY, len(rows)):
        mask = masks[index]
        app_experts, abs_experts = fast_experts(index)
        app_weights = normalize_weights(appearance_loss.values)
        abs_weights = normalize_weights(absence_loss.values)
        digit_probability = weighted_vectors(app_experts, app_weights)

        raw_app_pair = [
            (1 - digit_probability[a]) * (1 - digit_probability[b])
            for a, b in PAIRS
        ]
        long_app = app_experts["appearance_long"]
        long_absence = abs_experts["absence_long"]
        corrected_app_pair = []
        for pair_index, (a, b) in enumerate(PAIRS):
            independent = max(
                1e-6, (1 - long_app[a]) * (1 - long_app[b])
            )
            dependence = max(
                0.75, min(1.25, long_absence[pair_index] / independent)
            )
            corrected_app_pair.append(
                max(0.0, min(1.0, raw_app_pair[pair_index] * dependence))
            )

        absence_probability = weighted_vectors(abs_experts, abs_weights)
        appearance_pair = max(
            range(len(PAIRS)), key=lambda value: corrected_app_pair[value]
        )
        absence_pair = max(
            range(len(PAIRS)), key=lambda value: absence_probability[value]
        )

        predictions: dict[str, Any] = {
            "appearance": appearance_pair,
            "absence": absence_pair,
            "blends": {},
        }
        for blend in BLENDS:
            scores = [
                blend * corrected_app_pair[pair_index]
                + (1 - blend) * absence_probability[pair_index]
                for pair_index in range(len(PAIRS))
            ]
            predictions["blends"][str(blend)] = max(
                range(len(PAIRS)), key=lambda value: scores[value]
            )

        output.append(
            {
                "market": market,
                "side": side,
                "date": rows[index]["isoDate"],
                "block": block_for(rows[index]["isoDate"]),
                "source": rows[index].get("source"),
                "mask": mask,
                "randomReference": observed_random_rate(mask),
                "digitProbability": digit_probability,
                "appearanceWeights": app_weights,
                "absenceWeights": abs_weights,
                "appearancePair": appearance_pair,
                "absencePair": absence_pair,
                "blendPairs": predictions["blends"],
                "appearanceHit": pair_hit(appearance_pair, mask),
                "absenceHit": pair_hit(absence_pair, mask),
                "blendHits": {
                    key: pair_hit(pair_index, mask)
                    for key, pair_index in predictions["blends"].items()
                },
                "blendAbsentDigits": {
                    key: absent_digit_count(pair_index, mask)
                    for key, pair_index in predictions["blends"].items()
                },
                "digitBrier": digit_brier(digit_probability, mask),
                "familyAgreement": appearance_pair == absence_pair,
            }
        )

        appearance_loss.update(
            {
                name: digit_brier(probabilities, mask)
                for name, probabilities in app_experts.items()
            }
        )
        absence_loss.update(
            {
                name: pair_brier(probabilities, mask)
                for name, probabilities in abs_experts.items()
            }
        )

    return output


def accuracy(values: list[bool]) -> float:
    return sum(values) / len(values) if values else 0.0


def aggregate(
    rows: list[dict[str, Any]], blend: float
) -> dict[str, Any]:
    key = str(blend)
    hits = [bool(row["blendHits"][key]) for row in rows]
    market_side: dict[str, list[bool]] = defaultdict(list)
    for row, hit in zip(rows, hits):
        market_side[f"{row['market']}|{row['side']}"].append(hit)
    rates = {name: accuracy(values) for name, values in market_side.items()}
    return {
        "rows": len(rows),
        "hits": sum(hits),
        "strictAccuracy": accuracy(hits),
        "avgCorrectAbsentDigits": (
            sum(row["blendAbsentDigits"][key] for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "appearanceAccuracy": accuracy(
            [bool(row["appearanceHit"]) for row in rows]
        ),
        "absenceAccuracy": accuracy(
            [bool(row["absenceHit"]) for row in rows]
        ),
        "digitBrier": (
            sum(row["digitBrier"] for row in rows) / len(rows) if rows else 0.0
        ),
        "randomReference": (
            sum(row["randomReference"] for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "agreementRate": (
            sum(bool(row["familyAgreement"]) for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "marketMacroAccuracy": (
            sum(rates.values()) / len(rates) if rates else 0.0
        ),
        "worstMarketSideAccuracy": min(rates.values()) if rates else 0.0,
        "marketSides": rates,
    }


def paired_comparison(
    rows: list[dict[str, Any]], blend: float, comparator: str
) -> dict[str, Any]:
    key = str(blend)
    ensemble_only = 0
    comparator_only = 0
    both = 0
    neither = 0
    for row in rows:
        ensemble = bool(row["blendHits"][key])
        other = bool(row[f"{comparator}Hit"])
        if ensemble and other:
            both += 1
        elif ensemble:
            ensemble_only += 1
        elif other:
            comparator_only += 1
        else:
            neither += 1
    return {
        "ensembleOnly": ensemble_only,
        "comparatorOnly": comparator_only,
        "both": both,
        "neither": neither,
        "exactSignP": exact_sign_pvalue(ensemble_only, comparator_only),
    }


def select_market_routes(
    rows: list[dict[str, Any]], global_blend: float
) -> tuple[dict[str, float], dict[str, Any]]:
    validation = [row for row in rows if row["block"] == "validation"]
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in validation:
        grouped[f"{row['market']}|{row['side']}"].append(row)
    routes: dict[str, float] = {}
    details: dict[str, Any] = {}
    for name, values in grouped.items():
        base = accuracy(
            [bool(row["blendHits"][str(global_blend)]) for row in values]
        )
        candidates = {
            blend: accuracy(
                [bool(row["blendHits"][str(blend)]) for row in values]
            )
            for blend in BLENDS
        }
        best = max(
            BLENDS,
            key=lambda blend: (
                candidates[blend],
                -abs(blend - global_blend),
            ),
        )
        improvement = candidates[best] - base
        selected = best if len(values) >= 60 and improvement >= 0.03 else global_blend
        routes[name] = selected
        details[name] = {
            "rows": len(values),
            "globalBlend": global_blend,
            "globalAccuracy": base,
            "bestLocalBlend": best,
            "bestLocalAccuracy": candidates[best],
            "improvement": improvement,
            "selectedBlend": selected,
            "routed": selected != global_blend,
        }
    return routes, details


def aggregate_routed(
    rows: list[dict[str, Any]], routes: dict[str, float]
) -> dict[str, Any]:
    hits = []
    correct_digits = []
    market_side: dict[str, list[bool]] = defaultdict(list)
    for row in rows:
        name = f"{row['market']}|{row['side']}"
        blend = routes[name]
        key = str(blend)
        hit = bool(row["blendHits"][key])
        hits.append(hit)
        correct_digits.append(row["blendAbsentDigits"][key])
        market_side[name].append(hit)
    rates = {name: accuracy(values) for name, values in market_side.items()}
    return {
        "rows": len(rows),
        "hits": sum(hits),
        "strictAccuracy": accuracy(hits),
        "avgCorrectAbsentDigits": (
            sum(correct_digits) / len(correct_digits) if correct_digits else 0.0
        ),
        "marketMacroAccuracy": (
            sum(rates.values()) / len(rates) if rates else 0.0
        ),
        "worstMarketSideAccuracy": min(rates.values()) if rates else 0.0,
        "marketSides": rates,
    }


def routed_vs_global(
    rows: list[dict[str, Any]],
    routes: dict[str, float],
    global_blend: float,
) -> dict[str, Any]:
    routed_only = 0
    global_only = 0
    for row in rows:
        name = f"{row['market']}|{row['side']}"
        routed_hit = bool(row["blendHits"][str(routes[name])])
        global_hit = bool(row["blendHits"][str(global_blend)])
        routed_only += int(routed_hit and not global_hit)
        global_only += int(global_hit and not routed_hit)
    return {
        "routedOnly": routed_only,
        "globalOnly": global_only,
        "exactSignP": exact_sign_pvalue(routed_only, global_only),
    }


def select_blend(rows: list[dict[str, Any]]) -> tuple[float, dict[str, Any]]:
    validation = [row for row in rows if row["block"] == "validation"]
    scores = {}
    for blend in BLENDS:
        result = aggregate(validation, blend)
        scores[str(blend)] = {
            "strictAccuracy": result["strictAccuracy"],
            "avgCorrectAbsentDigits": result["avgCorrectAbsentDigits"],
            "hits": result["hits"],
            "rows": result["rows"],
        }
    selected = max(
        BLENDS,
        key=lambda blend: (
            scores[str(blend)]["strictAccuracy"],
            scores[str(blend)]["avgCorrectAbsentDigits"],
            -abs(blend - 0.5),
        ),
    )
    return selected, scores


def reliability_for_latest(
    series_rows: list[dict[str, Any]], blend: float
) -> dict[str, Any]:
    key = str(blend)
    latest = series_rows[-1]
    history = series_rows[:-1][-120:]
    hits = sum(bool(row["blendHits"][key]) for row in history)
    total = len(history)
    posterior = beta_rate(hits, total, RANDOM_PAIR_BASE, strength=10)
    lower, upper = wilson(hits, total)
    pair_index = latest["blendPairs"][key]
    a, b = PAIRS[pair_index]
    ranked_digits = sorted(
        range(10),
        key=lambda digit: latest["digitProbability"][digit],
        reverse=True,
    )
    app_support = sorted(
        latest["appearanceWeights"].items(), key=lambda item: item[1], reverse=True
    )[:2]
    abs_support = sorted(
        latest["absenceWeights"].items(), key=lambda item: item[1], reverse=True
    )[:2]
    return {
        "market": latest["market"],
        "side": latest["side"],
        "asOf": latest["date"],
        "candidateAvoidDigits": [a, b],
        "strictCall": lower >= 0.80 and total >= 30,
        "confidence": posterior,
        "historicalReliability": hits / total if total else 0.0,
        "reliabilitySample": total,
        "wilson95": [lower, upper],
        "familyAgreement": latest["familyAgreement"],
        "appearanceProbabilityByDigit": {
            str(digit): latest["digitProbability"][digit] for digit in DIGITS
        },
        "absenceProbabilityByDigit": {
            str(digit): 1 - latest["digitProbability"][digit] for digit in DIGITS
        },
        "mostLikelyDigits": ranked_digits[:5],
        "supportingModels": [
            {"name": name, "weight": weight}
            for name, weight in app_support + abs_support
        ],
    }


def next_scheduled_date(
    rows: list[dict[str, Any]], earliest: date
) -> tuple[str, str]:
    observed_days = {
        str(row.get("day"))
        for row in rows[-120:]
        if row.get("day") in DAY_OFFSETS
    }
    target = earliest
    while target.strftime("%A") not in observed_days:
        target += timedelta(days=1)
    return target.isoformat(), target.strftime("%A")


def build_forward_registry(
    rows_by_market: dict[str, list[dict[str, Any]]],
    selected_blend: float,
    source_hash: str,
    code_hash: str,
    generated_at: str,
) -> dict[str, Any]:
    registry_rows = []
    earliest = date(2026, 7, 25)
    for market in MARKETS:
        historical = rows_by_market[market]
        target_date, day_name = next_scheduled_date(historical, earliest)
        runtime_cutoff = (
            date.fromisoformat(target_date) - timedelta(days=729)
        ).isoformat()
        runtime_history = [
            row for row in historical if row["isoDate"] >= runtime_cutoff
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
            candidate = reliability_for_latest(
                run_series(market, side, runtime_history + [placeholder]),
                selected_blend,
            )
            registry_rows.append(
                {
                    **candidate,
                    "targetDate": target_date,
                    "sourceCutoff": historical[-1]["isoDate"],
                    "status": "CALL" if candidate["strictCall"] else "NO_SAFE_CALL",
                }
            )
    core = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "purpose": (
            "Hash-frozen post-2026-07-24 predictions. Outcomes must be appended "
            "later and must not alter these rows."
        ),
        "modelId": "absent-digits-complementary-online-v2",
        "appearanceBlendWeight": selected_blend,
        "codeHash": code_hash,
        "sourceHash": source_hash,
        "gate": {
            "minimumComparableCalls": 30,
            "minimumWilson95LowerBound": 0.80,
        },
        "rows": registry_rows,
    }
    canonical = json.dumps(core, sort_keys=True, separators=(",", ":")).encode()
    return {
        **core,
        "contentHash": hashlib.sha256(canonical).hexdigest(),
        "calls": sum(row["status"] == "CALL" for row in registry_rows),
        "abstentions": sum(
            row["status"] == "NO_SAFE_CALL" for row in registry_rows
        ),
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    rows_by_market, source_meta = load_rows()
    predictions: list[dict[str, Any]] = []
    series_predictions: dict[str, list[dict[str, Any]]] = {}
    for market in MARKETS:
        for side in ("open", "close"):
            key = f"{market}|{side}"
            series = run_series(market, side, rows_by_market[market])
            series_predictions[key] = series
            predictions.extend(series)

    selected_blend, validation_grid = select_blend(predictions)
    market_routes, market_route_details = select_market_routes(
        predictions, selected_blend
    )
    block_names = [
        "validation",
        "holdout",
        "recent",
        "post_cache",
        "independent_extension",
    ]
    blocks = {
        block: aggregate(
            [row for row in predictions if row["block"] == block],
            selected_blend,
        )
        for block in block_names
    }
    routed_blocks = {
        block: aggregate_routed(
            [row for row in predictions if row["block"] == block],
            market_routes,
        )
        for block in block_names
    }
    routed_comparisons = {
        block: routed_vs_global(
            [row for row in predictions if row["block"] == block],
            market_routes,
            selected_blend,
        )
        for block in block_names
    }
    comparisons = {
        block: {
            family: paired_comparison(
                [row for row in predictions if row["block"] == block],
                selected_blend,
                family,
            )
            for family in ("appearance", "absence")
        }
        for block in block_names
    }
    latest = [
        reliability_for_latest(series, selected_blend)
        for series in series_predictions.values()
        if series
    ]
    calls = sum(bool(item["strictCall"]) for item in latest)

    source_hash = hashlib.sha256(
        (
            EXTENDED.read_bytes()
            + b"\n"
            + INDEPENDENT.read_bytes()
        )
    ).hexdigest()
    code_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    generated_at = datetime.now(timezone.utc).isoformat()
    output = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "modelId": "absent-digits-complementary-online-v2",
        "sourceHash": source_hash,
        "codeHash": code_hash,
        "sourceMeta": source_meta,
        "selectedBlendAppearanceWeight": selected_blend,
        "validationGrid": validation_grid,
        "marketRoutes": market_route_details,
        "blocks": blocks,
        "routedBlocks": routed_blocks,
        "routedComparisons": routed_comparisons,
        "pairedComparisons": comparisons,
        "latest": latest,
        "strictCalls": calls,
        "abstentions": len(latest) - calls,
    }
    (HERE / "results.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )
    forward_registry = build_forward_registry(
        rows_by_market,
        selected_blend,
        source_hash,
        code_hash,
        generated_at,
    )
    (HERE / "FROZEN_FORWARD_REGISTRY.json").write_text(
        json.dumps(forward_registry, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        "# Complementary Absent-Digits Research V2",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        "## Decision",
        "",
    ]
    confirm_blocks = ["holdout", "recent", "post_cache", "independent_extension"]
    best_confirm = max(
        (blocks[name]["strictAccuracy"] for name in confirm_blocks),
        default=0.0,
    )
    if calls == 0:
        lines.append(
            "No market-side clears the frozen 80% Wilson-lower-bound gate. "
            "The engine therefore produces research candidates but abstains "
            "from every actionable avoid call."
        )
    else:
        lines.append(
            f"{calls} market-sides clear the frozen gate. They remain research "
            "candidates until a genuinely prospective cohort confirms them."
        )
    lines.extend(
        [
            "",
            f"Validation selected appearance-family weight "
            f"`{selected_blend:.2f}`; the remaining weight is assigned to the "
            "direct absence family.",
            "",
            "## Chronological results",
            "",
            "| Block | N | Ensemble strict | Appearance only | Absence only | Random reference | Avg absent digits | Macro | Worst market-side | Agreement |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in block_names:
        item = blocks[block]
        lines.append(
            f"| {block.replace('_', ' ').title()} | {item['rows']} | "
            f"{pct(item['strictAccuracy'])} ({item['hits']}/{item['rows']}) | "
            f"{pct(item['appearanceAccuracy'])} | "
            f"{pct(item['absenceAccuracy'])} | "
            f"{pct(item['randomReference'])} | "
            f"{item['avgCorrectAbsentDigits']:.3f}/2 | "
            f"{pct(item['marketMacroAccuracy'])} | "
            f"{pct(item['worstMarketSideAccuracy'])} | "
            f"{pct(item['agreementRate'])} |"
        )
    lines.extend(
        [
            "",
            "## Paired tests",
            "",
            "| Block | Comparator | Ensemble-only | Comparator-only | Exact sign p |",
            "| --- | --- | ---: | ---: | ---: |",
        ]
    )
    for block in block_names:
        for family in ("appearance", "absence"):
            item = comparisons[block][family]
            lines.append(
                f"| {block.replace('_', ' ').title()} | {family} | "
                f"{item['ensembleOnly']} | {item['comparatorOnly']} | "
                f"{item['exactSignP']:.4f} |"
            )
    routed_count = sum(
        int(detail["routed"]) for detail in market_route_details.values()
    )
    lines.extend(
        [
            "",
            "## Market-specific routing test",
            "",
            f"Validation routed {routed_count}/{len(market_route_details)} "
            "market-sides away from the global blend. A local route required "
            "at least 60 validation rows and a 3-point validation advantage.",
            "",
            "| Block | Global | Routed | Routed-only | Global-only | Exact sign p |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in block_names:
        global_item = blocks[block]
        routed_item = routed_blocks[block]
        comparison = routed_comparisons[block]
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(global_item['strictAccuracy'])} | "
            f"{pct(routed_item['strictAccuracy'])} | "
            f"{comparison['routedOnly']} | {comparison['globalOnly']} | "
            f"{comparison['exactSignP']:.4f} |"
        )
    lines.extend(
        [
            "",
            "## Confidence gate",
            "",
            f"- Actionable calls: {calls}/{len(latest)}",
            f"- Abstentions: {len(latest) - calls}/{len(latest)}",
            "- Confidence is a shrunk trailing hit rate; actionability uses the "
            "95% Wilson lower bound, never the raw model score.",
            "- Model A and Model B are complementary target formulations, but "
            "they use the same outcome history and must not be described as "
            "statistically independent.",
            "",
            "## Interpretation",
            "",
            f"- The strongest confirmation-block aggregate was "
            f"{pct(best_confirm)}, not 80%.",
            "- The experiment directly tests the requested appearance-plus-"
            "absence ensemble. Any improvement is accepted only if it persists "
            "outside the validation block and wins paired tests.",
            "- All available blocks are now inspected. The next honest evidence "
            "must come from predictions hash-frozen before future results.",
            f"- `FROZEN_FORWARD_REGISTRY.json` contains "
            f"{forward_registry['calls']} calls and "
            f"{forward_registry['abstentions']} abstentions for the next "
            "eligible dates on or after 2026-07-25.",
            "",
            "## Reproduce",
            "",
            "```powershell",
            "python research/absent_digits_v2/run_research.py",
            "```",
        ]
    )
    (HERE / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
