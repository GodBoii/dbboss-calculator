"""Combined prediction V3 research library.

Research only. Production sources are read, never written. The library rebuilds
the production combined-model endpoint distributions (COMBINED_POLICY) from the
frozen V1 replay and the frozen October extension replay, so that new
combination terms can be tested against the actual production policy.

New degrees of freedom tested here (never used by combined_prediction_v1/v2):
  present_soft -- soft per-digit appearance probabilities from the production
                  present-digit model (exported as `presentAppearance`, unused).
  kind_tilt    -- an explicit log multiplier on the DP panel-kind mass. The
                  production dp_blend only redistributes mass inside the DP
                  kind; it never changes the SP/DP split.
"""
from __future__ import annotations

import gzip
import hashlib
import itertools
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.stats import binomtest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
V1 = ROOT / "research" / "combined_prediction_v1"
V2 = ROOT / "research" / "combined_prediction_v2"
PROTOCOL = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
PAIRS = list(itertools.combinations(range(10), 2))
WEIGHT_KEYS = ("sutta", "appearance", "avoid_multiplier", "present_multiplier", "dp_blend", "conditional_close")
TASK_TITLES = {task: f"{task}" for task in PROTOCOL["panel_tasks"]}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def softmax(scores: np.ndarray) -> np.ndarray:
    weights = np.exp(scores - scores.max(axis=-1, keepdims=True))
    return weights / weights.sum(axis=-1, keepdims=True)


def logit(probabilities: np.ndarray) -> np.ndarray:
    clipped = np.clip(probabilities, 1e-6, 1 - 1e-6)
    return np.log(clipped) - np.log1p(-clipped)


@dataclass(frozen=True, order=True)
class Change:
    """A research-only modification on top of the frozen production policy."""

    present_soft: float = 0.0
    kind_tilt: float = 0.0
    present_soft_only: bool = False

    def complexity(self) -> float:
        added = (self.present_soft != 0) + (self.kind_tilt != 0) + (1 if self.present_soft_only else 0)
        return float(added) + 1e-3 * (abs(self.present_soft) + abs(self.kind_tilt))

    def label(self) -> str:
        parts = []
        if self.present_soft:
            parts.append(f"present_soft={self.present_soft:g}")
        if self.kind_tilt:
            parts.append(f"kind_tilt={self.kind_tilt:g}")
        if self.present_soft_only:
            parts.append("present_soft_only")
        return ";".join(parts) if parts else "production"

    def as_dict(self) -> dict:
        return {"present_soft": self.present_soft, "kind_tilt": self.kind_tilt, "present_soft_only": self.present_soft_only}


def candidate_changes() -> list[Change]:
    grid = PROTOCOL["candidates"]
    output: dict[Change, None] = {}
    output[Change()] = None
    for weight in grid["present_soft_weights"]:
        output[Change(present_soft=float(weight))] = None
    for tilt in grid["kind_tilts"]:
        output[Change(kind_tilt=float(tilt))] = None
    for weight in grid["present_soft_weights"]:
        for tilt in grid["kind_tilts"]:
            output[Change(present_soft=float(weight), kind_tilt=float(tilt))] = None
    for weight in grid["present_soft_only_weights"]:
        output[Change(present_soft=float(weight), present_soft_only=True)] = None
    return sorted(output)


class Replay:
    """Frozen production feature replay for July 4 - October 15, 2026."""

    def __init__(self) -> None:
        meta_history = json.loads((V1 / "replay_metadata.json").read_text(encoding="utf-8"))
        raw_history = gzip.decompress((V1 / "replay.jsonl.gz").read_bytes())
        if digest_bytes(raw_history) != meta_history["replaySHA256"]:
            raise ValueError("V1 replay hash mismatch")
        rows_history = [json.loads(line) for line in raw_history.splitlines()]
        meta_extension = json.loads((V2 / "extension_replay_metadata.json").read_text(encoding="utf-8"))
        raw_extension = gzip.decompress((V2 / "extension_replay.jsonl.gz").read_bytes())
        if digest_bytes(raw_extension) != meta_extension["sha256"]:
            raise ValueError("October replay hash mismatch")
        rows_extension = [json.loads(line) for line in raw_extension.splitlines()]
        self.meta = {"history": meta_history, "extension": meta_extension}
        self._load(rows_history + rows_extension, validate_blocks=True)

    @classmethod
    def from_rows(cls, rows: list[dict]) -> "Replay":
        """Build a replay view over externally exported rows (fresh extension)."""
        instance = cls.__new__(cls)
        instance.meta = {"history": json.loads((V1 / "replay_metadata.json").read_text(encoding="utf-8"))}
        instance._load(rows, validate_blocks=False)
        return instance

    def _load(self, rows: list[dict], *, validate_blocks: bool) -> None:
        self.rows = rows
        meta_history = self.meta["history"]
        dates = [row["date"] for row in self.rows]
        keys = [(row["date"], row["market"]) for row in self.rows]
        if len(set(keys)) != len(keys):
            raise ValueError("Duplicate replay event")
        if dates != sorted(dates):
            raise ValueError("Replay rows are not date-sorted")
        for row in self.rows:
            if row["historyMaxDate"] >= row["date"]:
                raise ValueError("Future history leakage")
            if row["historyCount"] < PROTOCOL["minimum_history"]:
                raise ValueError("Short history row")
        self.dates = np.array(dates)
        self.markets = np.array([row["market"] for row in self.rows])

        self.panels = meta_history["panelOrder"]
        self.panel_index = {panel: index for index, panel in enumerate(self.panels)}
        if len(self.panels) != 220 or len(meta_history["dpOrder"]) != 90:
            raise ValueError("Unexpected panel universe")
        self.digits = np.array([[float(digit in panel) for digit in "0123456789"] for panel in self.panels])
        self.sutta = np.array([sum(map(int, panel)) % 10 for panel in self.panels])
        self.kind = np.array(["SP" if len(set(panel)) == 3 else "DP" if len(set(panel)) == 2 else "TP" for panel in self.panels])
        if not ((self.kind == "SP").sum() == 120 and (self.kind == "DP").sum() == 90 and (self.kind == "TP").sum() == 10):
            raise ValueError("Panel kind counts changed")
        self.dp_index = np.array([self.panel_index[panel] for panel in meta_history["dpOrder"]])
        self.sutta_matrix = np.eye(10)[self.sutta]
        self.pair_present = np.array([self.digits[:, a] * self.digits[:, b] for a, b in PAIRS]).T
        self.pair_absent = np.array([(1 - self.digits[:, a]) * (1 - self.digits[:, b]) for a, b in PAIRS]).T

        self.actual_open = np.array([self.panel_index[row["actualOpen"]] for row in self.rows])
        self.actual_close = np.array([self.panel_index[row["actualClose"]] for row in self.rows])

        blocks = PROTOCOL["blocks"]
        if validate_blocks:
            self.development = (self.dates >= blocks["development"][0]) & (self.dates <= blocks["development"][1])
            self.validation = (self.dates >= blocks["validation"][0]) & (self.dates <= blocks["validation"][1])
            self.audit = (self.dates >= blocks["audit"][0]) & (self.dates <= blocks["audit"][1])
            self.extension = (self.dates >= blocks["extension"][0]) & (self.dates <= blocks["extension"][1])
            if not (self.development | self.validation | self.audit | self.extension).all():
                raise ValueError("Event outside declared blocks")
        else:
            # Fresh-extension view: rows intentionally live outside the frozen
            # blocks, so every declared-block mask is empty.
            empty = np.zeros(len(self.rows), dtype=bool)
            self.development = empty
            self.validation = empty
            self.audit = empty
            self.extension = empty

        self.channels: dict[str, dict[str, np.ndarray]] = {}
        for channel in PROTOCOL["channels"]:
            values = [row["channels"][channel] for row in self.rows]
            avoid = np.array([value["avoid"] for value in values], dtype=int)
            present = np.array([value["present"] for value in values], dtype=int)
            if avoid.shape != (len(self.rows), 2) or present.shape != (len(self.rows), 2):
                raise ValueError("Unexpected predicted-digit list shapes")
            self.channels[channel] = {
                "logits": np.array([value["logits"] for value in values], dtype=float),
                "dp": np.array([value["dpProbabilities"] for value in values], dtype=float),
                "sutta": np.array([value["sutta"] for value in values], dtype=float),
                "absent": np.array([value["appearance"] for value in values], dtype=float),
                "present_soft": np.array([value["presentAppearance"] for value in values], dtype=float),
                "avoid_count": self.digits[:, avoid].sum(axis=2).T,
                "present_count": self.digits[:, present].sum(axis=2).T,
                "conditional": np.array([value["conditionalSutta"] for value in values], dtype=float),
            }
            for key, array in self.channels[channel].items():
                if not np.isfinite(array).all():
                    raise ValueError(f"Non-finite replay feature {channel}/{key}")

        policy_row = json.loads((HERE / "production_policy.json").read_text(encoding="utf-8"))
        if sha256(ROOT / policy_row["source"]) != policy_row["sourceSHA256"]:
            raise ValueError("Production combined-policy source changed; rerun dump_policy.cjs")
        self.policy = policy_row["policy"]
        self._weight_cache: dict[tuple[str, str], dict[str, np.ndarray]] = {}

    def actual(self, channel: str) -> np.ndarray:
        return self.actual_open if channel == "open" else self.actual_close

    def production_weights(self, channel: str, endpoint: str) -> dict[str, np.ndarray]:
        key = (channel, endpoint)
        if key not in self._weight_cache:
            endpoint_policy = self.policy[channel][endpoint]
            output = {}
            for name in WEIGHT_KEYS:
                output[name] = np.array([
                    float(endpoint_policy["markets"].get(market, endpoint_policy["weights"])[name])
                    for market in self.markets
                ])
            self._weight_cache[key] = output
        return self._weight_cache[key]

    def endpoint_probs(self, channel: str, endpoint: str, change: Change = Change(),
                       weights: dict[str, np.ndarray] | None = None) -> np.ndarray:
        """Exact production fusion, optionally plus the two research terms.

        `weights` overrides the frozen production weights (used only for the
        raw no-adjustment diagnostic in the report)."""
        features = self.channels[channel]
        if weights is None:
            weights = self.production_weights(channel, endpoint)
        present_multiplier = np.ones_like(weights["present_multiplier"]) if change.present_soft_only else weights["present_multiplier"]
        q = softmax(features["logits"])
        mass = q[:, self.dp_index].sum(axis=1, keepdims=True)
        adjusted = q.copy()
        adjusted[:, self.dp_index] = ((1 - weights["dp_blend"][:, None]) * q[:, self.dp_index]
                                      + weights["dp_blend"][:, None] * mass * features["dp"])
        sutta_mass = adjusted @ self.sutta_matrix
        digit_mass = adjusted @ self.digits
        term_sutta = np.log(features["sutta"] / sutta_mass)[:, self.sutta]
        term_absent = (logit(features["absent"]) - logit(digit_mass)) @ self.digits.T
        term_conditional = np.log(features["conditional"] / sutta_mass)[:, self.sutta]
        scores = (np.log(adjusted)
                  + weights["sutta"][:, None] * term_sutta
                  + weights["appearance"][:, None] * term_absent
                  + np.log(weights["avoid_multiplier"])[:, None] * features["avoid_count"]
                  + np.log(present_multiplier)[:, None] * features["present_count"]
                  + weights["conditional_close"][:, None] * term_conditional)
        if change.present_soft:
            term_present_soft = (logit(features["present_soft"]) - logit(digit_mass)) @ self.digits.T
            scores = scores + change.present_soft * term_present_soft
        if change.kind_tilt:
            scores = scores + change.kind_tilt * (self.kind == "DP")
        return softmax(scores)

    def panel_hits(self, channel: str, probs: np.ndarray) -> dict[str, tuple[np.ndarray, np.ndarray]]:
        actual = self.actual(channel)
        events = len(actual)
        index = np.arange(len(self.panels))
        actual_probability = probs[np.arange(events), actual]
        ahead = (probs > actual_probability[:, None]) | ((probs == actual_probability[:, None]) & (index[None, :] < actual[:, None]))
        output = {}
        for task, (kind, count) in PROTOCOL["panel_tasks"].items():
            allowed = np.ones(len(self.panels), dtype=bool) if kind == "all" else (self.kind == kind)
            eligible = np.ones(events, dtype=bool) if kind == "all" else (self.kind[actual] == kind)
            rank = 1 + (ahead & allowed[None, :]).sum(axis=1)
            output[task] = ((rank <= count) & eligible, eligible)
        return output

    def sutta_order(self, probs: np.ndarray, count: int) -> np.ndarray:
        sutta_probs = probs @ self.sutta_matrix
        return np.argsort(-sutta_probs, axis=1, kind="stable")[:, :count]

    def derived_hits(self, channel: str, probs: np.ndarray) -> dict[str, np.ndarray]:
        actual = self.actual(channel)
        actual_sutta = self.sutta[actual]
        order = self.sutta_order(probs, 6)
        present_pair = np.argmax(probs @ self.pair_present, axis=1)
        absent_pair = np.argmax(probs @ self.pair_absent, axis=1)
        return {
            "sutta6": (order == actual_sutta[:, None]).any(axis=1),
            "present2": self.pair_present[actual, present_pair].astype(bool),
            "absent2": self.pair_absent[actual, absent_pair].astype(bool),
        }

    def jodi_hits(self, open_order: np.ndarray, close_order: np.ndarray) -> np.ndarray:
        actual_open = self.sutta[self.actual_open]
        actual_close = self.sutta[self.actual_close]
        return ((open_order == actual_open[:, None]).any(axis=1)
                & (close_order == actual_close[:, None]).any(axis=1))

    def probabilistic_losses(self, probs: np.ndarray, channel: str) -> dict[str, float]:
        actual = self.actual(channel)
        events = len(actual)
        one_hot = np.zeros_like(probs)
        one_hot[np.arange(events), actual] = 1.0
        brier = float(((probs - one_hot) ** 2).sum(axis=1).mean())
        log_loss = float(-np.log(np.clip(probs[np.arange(events), actual], 1e-12, None)).mean())
        return {"brier": brier, "log_loss": log_loss}


def counts(hits: np.ndarray, eligible: np.ndarray, mask: np.ndarray) -> dict:
    use = eligible & mask
    return {
        "hits": int(hits[use].sum()),
        "n": int(use.sum()),
        "rate": float(hits[use].mean()) if use.any() else 0.0,
    }


def paired(replay: Replay, baseline: np.ndarray, candidate: np.ndarray, eligible: np.ndarray, mask: np.ndarray) -> dict:
    use = eligible & mask
    if not use.any():
        return {"n": 0, "baseline_hits": 0, "candidate_hits": 0, "lift_pp": 0.0,
                "day_bootstrap95_pp": [0.0, 0.0], "paired_p": 1.0, "candidate_only": 0, "baseline_only": 0,
                "baseline_rate": 0.0, "candidate_rate": 0.0}
    current, challenger = baseline[use], candidate[use]
    delta = challenger.astype(float) - current.astype(float)
    dates = replay.dates[use]
    unique = np.unique(dates)
    day_n = np.array([(dates == day).sum() for day in unique])
    day_sum = np.array([delta[dates == day].sum() for day in unique])
    rng = np.random.default_rng(PROTOCOL["seed"])
    indices = rng.integers(0, len(unique), size=(PROTOCOL["bootstrap_samples"], len(unique)))
    draws = day_sum[indices].sum(axis=1) / day_n[indices].sum(axis=1)
    wins = int(((~current) & challenger).sum())
    losses = int((current & (~challenger)).sum())
    p_value = float(binomtest(wins, wins + losses).pvalue) if wins + losses else 1.0
    return {
        "n": int(len(current)),
        "baseline_hits": int(current.sum()),
        "candidate_hits": int(challenger.sum()),
        "baseline_rate": float(current.mean()),
        "candidate_rate": float(challenger.mean()),
        "lift_pp": float(100 * delta.mean()),
        "day_bootstrap95_pp": (100 * np.quantile(draws, [0.025, 0.975])).tolist(),
        "candidate_only": wins,
        "baseline_only": losses,
        "paired_p": p_value,
    }


def selection_items() -> list[dict]:
    items = []
    for channel in PROTOCOL["channels"]:
        for endpoint, task in PROTOCOL["primary_panel_task"].items():
            items.append({"kind": "panel", "channel": channel, "endpoint": endpoint, "task": task})
        for task in PROTOCOL["derived_tasks"]:
            items.append({"kind": "derived", "channel": channel, "endpoint": "sp30", "task": task})
    return items


def item_hits(replay: Replay, item: dict, probs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if item["kind"] == "panel":
        return replay.panel_hits(item["channel"], probs)[item["task"]]
    hits = replay.derived_hits(item["channel"], probs)[item["task"]]
    return hits, np.ones(len(hits), dtype=bool)


def evaluate_change(replay: Replay, item: dict, change: Change) -> tuple[dict, dict]:
    probs = replay.endpoint_probs(item["channel"], item["endpoint"], change)
    hits, eligible = item_hits(replay, item, probs)
    return (counts(hits, eligible, replay.development), counts(hits, eligible, replay.validation))
