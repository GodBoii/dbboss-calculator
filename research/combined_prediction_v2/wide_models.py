"""Research candidates and strictly prior-observable context for V2.

Nothing here is imported by the app. The V1 replay is a frozen input, not edited.
"""
from __future__ import annotations

import bisect
import csv
import gzip
import hashlib
import itertools
import json
import subprocess
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / "combined_prediction_v1"))
from run_experiment import Replay, Weights, logit, softmax  # noqa: E402

PROTOCOL = json.loads((HERE / "protocol.json").read_text())


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


@lru_cache(maxsize=1)
def timings() -> dict:
    code = "require('./research/dp_panel_v3/ts-loader.cjs');console.log(JSON.stringify(require('./src/lib/market-schedule.ts').MARKET_TIMINGS))"
    output = subprocess.check_output(["node", "-e", code], cwd=ROOT, text=True)
    return json.loads(output)


def history_rows(extension: bool = False) -> list[dict]:
    with (ROOT / PROTOCOL["source"]).open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if extension:
        with (HERE / "october_rows.csv").open(encoding="utf-8", newline="") as handle:
            rows += list(csv.DictReader(handle))
    seen = {}
    for row in rows:
        key = row["date"], row["market"]
        if key in seen and seen[key] != row:
            raise ValueError(f"Conflicting outcome {key}")
        seen[key] = row
    return sorted(seen.values(), key=lambda r: (r["date"], r["market"]))


class StudyReplay(Replay):
    def __init__(self, extension: bool = False) -> None:
        super().__init__(include_audit=True)
        if not extension:
            return
        with gzip.open(HERE / "extension_replay.jsonl.gz", "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle]
        self.rows = rows
        self.dates = np.array([r["date"] for r in rows])
        self.markets = np.array([r["market"] for r in rows])
        self.actual_open = np.array([self.panel_index[r["actualOpen"]] for r in rows])
        self.actual_close = np.array([self.panel_index[r["actualClose"]] for r in rows])
        self.conditional = np.array([r["conditionalClose"] for r in rows])
        self.channels = {}
        for channel in PROTOCOL["channels"]:
            values = [r["channels"][channel] for r in rows]
            avoid, present = (np.array([v[k] for v in values]) for k in ("avoid", "present"))
            self.channels[channel] = {
                "base": softmax(np.array([v["logits"] for v in values])),
                "dp": np.array([v["dpProbabilities"] for v in values]),
                "sutta": np.array([v["sutta"] for v in values]),
                "appearance": np.array([v["appearance"] for v in values]),
                "conditional": np.array([v["conditionalSutta"] for v in values]),
                "avoid": avoid, "present": present,
                "avoid_count": np.array([self.digits[:, pair].sum(axis=1) for pair in avoid]),
                "present_count": np.array([self.digits[:, pair].sum(axis=1) for pair in present]),
            }
        self._base_cache = {}


def stable_ranks(scores: np.ndarray) -> np.ndarray:
    order = np.argsort(-scores, axis=1, kind="stable")
    ranks = np.empty_like(order)
    np.put_along_axis(ranks, order, np.broadcast_to(np.arange(scores.shape[1]), scores.shape), axis=1)
    return ranks


def centered(values: np.ndarray) -> np.ndarray:
    out = values - values.mean(axis=1, keepdims=True)
    return np.clip(out / np.maximum(values.std(axis=1, keepdims=True), 1e-4), -4, 4)


class Context:
    def __init__(self, replay: StudyReplay, channel: str, records: list[dict]) -> None:
        self.replay, self.channel = replay, channel
        self.base_log, sutta, appearance, conditional = replay.base(channel, 0)
        self.q = replay.channels[channel]["base"]
        self.features = {"sutta": sutta, "appearance": appearance,
                         "avoid": replay.channels[channel]["avoid_count"],
                         "present": replay.channels[channel]["present_count"], "conditional": conditional}
        self.states = {}
        self.expert_cache: dict[str, np.ndarray] = {}
        self.rank_cache: dict[str, np.ndarray] = {}
        self._historical(records)
        self.feature_names = list(self.features)

    def _historical(self, records: list[dict]) -> None:
        r, channel = self.replay, self.channel
        by_market: dict[str, list[dict]] = defaultdict(list)
        by_date: dict[str, list[dict]] = defaultdict(list)
        for row in records:
            if row["open"] not in r.panel_index or row["close"] not in r.panel_index:
                continue
            by_market[row["market"]].append(row)
            by_date[row["date"]].append(row)
        dates = {m: [row["date"] for row in rows] for m, rows in by_market.items()}
        side = "open" if channel == "open" else "close"
        outputs = {key: [] for key in ("frequency30", "frequency180", "frequency_all", "weekday", "gap", "previous_overlap", "opposite_overlap", "live_digits", "live_sutta", "shape_repeat")}
        states = {key: [] for key in ("weekend", "previous_dp", "known_open_dp", "dp_recent", "source_count", "day_mod3", "weekday")}
        for event in r.rows:
            series = by_market[event["market"]]
            a = bisect.bisect_left(dates[event["market"]], event["historyCutoff"])
            b = bisect.bisect_left(dates[event["market"]], event["date"])
            prior = series[a:b]
            if not prior:
                raise ValueError("Missing prior history")
            own = np.array([r.panel_index[row[side]] for row in prior])
            weekday = date.fromisoformat(event["date"]).weekday()
            for name, history in (("frequency30", own[-30:]), ("frequency180", own[-180:]), ("frequency_all", own)):
                cnt = np.bincount(history, minlength=220)
                outputs[name].append(np.log((cnt + .5) / (len(history) + 110)))
            wh = [own[i] for i, row in enumerate(prior) if date.fromisoformat(row["date"]).weekday() == weekday]
            wc = np.bincount(wh, minlength=220)
            outputs["weekday"].append(np.log((wc + 1) / (len(wh) + 220)))
            last = np.full(220, -1)
            np.maximum.at(last, own, np.arange(len(own)))
            outputs["gap"].append(np.log1p(np.where(last >= 0, len(own) - 1 - last, len(own) + 1)))
            previous = r.panel_index[prior[-1][side]]
            outputs["previous_overlap"].append(r.digits @ r.digits[previous])
            opposite = np.roll(r.digits[previous], 5)
            outputs["opposite_overlap"].append(r.digits @ opposite)
            shape = len(set(prior[-1][side]))
            outputs["shape_repeat"].append(np.array([float(len(set(p)) == shape) for p in r.panels]))
            target_key = "closeMinutes" if channel == "close_known" else "openMinutes"
            target_time = timings()[event["market"]][target_key]
            live = []
            for source in by_date.get(event["date"], []):
                if source["market"] not in timings():
                    continue
                for source_side in ("open", "close"):
                    source_time = timings()[source["market"]][source_side + "Minutes"]
                    if source_time + PROTOCOL["scheduled_availability_grace_minutes"] < target_time:
                        if source["market"] == event["market"] and (channel != "close_known" or source_side != "open"):
                            continue
                        live.append(r.panel_index[source[source_side]])
            live_digits = (r.digits[live].sum(axis=0) + 2.7) / (len(live) + 10)
            live_sutta = (np.bincount(r.sutta[live], minlength=10) + 2) / (len(live) + 20)
            outputs["live_digits"].append(logit(live_digits) @ r.digits.T)
            outputs["live_sutta"].append(np.log(live_sutta)[r.sutta])
            states["weekend"].append(weekday >= 5)
            states["previous_dp"].append(r.kind[previous] == "DP")
            states["known_open_dp"].append(channel == "close_known" and len(set(event["actualOpen"])) == 2)
            states["dp_recent"].append(float((r.kind[own[-10:]] == "DP").mean()))
            states["source_count"].append(len(live))
            states["day_mod3"].append(int(event["date"][-2:]) % 3)
            states["weekday"].append(weekday)
        for name, values in outputs.items():
            value = np.array(values)
            self.features[name] = value - self.base_log if name.startswith("frequency") or name == "weekday" else centered(value)
        self.states.update({k: np.array(v) for k, v in states.items()})
        self.states["entropy"] = -(self.q * self.base_log).sum(axis=1) / np.log(220)
        sr = stable_ranks(np.log(r.channels[channel]["sutta"]))
        br = stable_ranks(np.log(self.q @ r.sutta_matrix))
        self.states["agreement"] = np.array([len(set(np.flatnonzero(sr[i] < 3)) & set(np.flatnonzero(br[i] < 3))) for i in range(len(sr))])
        self.states["pair_conflict"] = np.array([len(set(a) & set(p)) for a, p in zip(r.channels[channel]["avoid"], r.channels[channel]["present"])])

    def preserve_kind(self, scores: np.ndarray) -> np.ndarray:
        out = np.empty_like(scores)
        for kind in ("SP", "DP", "TP"):
            mask = self.replay.kind == kind
            mass = self.q[:, mask].sum(axis=1, keepdims=True)
            out[:, mask] = softmax(scores[:, mask]) * mass
        return out

    def expert(self, name: str) -> np.ndarray:
        if name in self.expert_cache:
            return self.expert_cache[name]
        if name == "base":
            out = self.q
        elif name == "dp":
            out = softmax(self.replay.base(self.channel, 1)[0])
        elif name in self.features:
            out = self.preserve_kind(self.base_log + self.features[name])
        elif name.startswith("negative_"):
            out = self.preserve_kind(self.base_log - self.features[name.removeprefix("negative_")])
        elif name == "present_both":
            out = self.preserve_kind(self.base_log + 2 * (self.features["present"] == 2))
        elif name == "avoid_both":
            out = self.preserve_kind(self.base_log + 2 * (self.features["avoid"] == 0))
        else:
            raise ValueError(f"Unknown expert {name}")
        self.expert_cache[name] = out
        return out

    def ranks(self, expert: str) -> np.ndarray:
        if expert not in self.rank_cache:
            self.rank_cache[expert] = stable_ranks(self.expert(expert))
        return self.rank_cache[expert]


@dataclass(frozen=True)
class Candidate:
    family: str
    parameters: dict

    def key(self) -> str:
        return json.dumps({"family": self.family, "parameters": self.parameters}, sort_keys=True, separators=(",", ":"))


def catalogue(channel: str) -> list[Candidate]:
    output: dict[str, Candidate] = {}

    def add(family: str, **parameters: object) -> None:
        candidate = Candidate(family, parameters)
        output[candidate.key()] = candidate

    grid = PROTOCOL["weights"]
    add("loglinear", **asdict(Weights()))
    add("loglinear", **asdict(Weights(dp_blend=1)))
    for name, values in grid.items():
        if name == "conditional_close" and channel == "open":
            continue
        for value in values:
            params = asdict(Weights()) | {name: value}
            add("loglinear", **params)
            add("loglinear", **(params | {"dp_blend": 1}))
    rng = np.random.default_rng(PROTOCOL["seed"] + PROTOCOL["channels"].index(channel))
    for _ in range(PROTOCOL["random_sparse_configurations_per_channel"]):
        params = asdict(Weights())
        active = rng.choice(list(grid), size=int(rng.integers(2, 6)), replace=False)
        for name in active:
            if name != "conditional_close" or channel != "open":
                params[name] = float(rng.choice(grid[name]))
        add("loglinear", **params)
    experts = ["sutta", "appearance", "conditional", "frequency30", "frequency180", "frequency_all", "weekday", "gap", "live_digits", "live_sutta", "negative_appearance", "negative_sutta", "present_both", "avoid_both", "dp"]
    for expert, weight in itertools.product(experts, [.1, .25, .5, .75, 1]):
        for method in ("arithmetic", "geometric", "harmonic"):
            add("mixture", experts=["base", expert], weight=weight, method=method)
        for method in ("borda", "rrf5", "rrf30", "rrf100"):
            add("rank_fusion", experts=["base", expert], weight=weight, method=method)
    for experts3 in itertools.combinations(["sutta", "appearance", "frequency180", "live_sutta", "dp"], 2):
        for method in ("arithmetic", "geometric", "harmonic", "median", "minimum", "maximum", "vote"):
            add("consensus", experts=["base", *experts3], method=method)
    for feature, weight in itertools.product(["frequency30", "frequency180", "frequency_all", "weekday", "gap", "previous_overlap", "opposite_overlap", "live_digits", "live_sutta", "shape_repeat"], [-2, -1, -.5, -.25, .25, .5, 1, 2]):
        add("historical_tilt", feature=feature, weight=weight)
    for transform, amount, weight in itertools.product(["rotate", "mirror"], [1, 3, 5, 7, 9], [-2, -.5, .25, 1, 2]):
        for target in ("sutta", "appearance"):
            add("transformed_digits", transform=transform, amount=amount, weight=weight, target=target)
    for left, right in itertools.combinations(["sutta", "appearance", "avoid", "present", "conditional", "live_sutta"], 2):
        for weight in [-2, -.5, .5, 2]:
            add("nonlinear_interaction", left=left, right=right, weight=weight)
    for state, threshold in [("weekend", .5), ("previous_dp", .5), ("known_open_dp", .5), ("dp_recent", .3), ("agreement", 1.5), ("pair_conflict", .5), ("source_count", 4), ("day_mod3", 1), ("weekday", 2)]:
        for feature, weight in itertools.product(["sutta", "appearance", "avoid", "live_sutta"], [.25, 1, 2]):
            add("regime_flip", state=state, threshold=threshold, feature=feature, weight=weight)
    for weight, within in itertools.product([-.5, 0, .25, .5, 1, 2], [.1, .5, 1, 2]):
        add("sutta_buckets", weight=weight, within=within)
    for prefix, expert in itertools.product([1, 3, 6, 10], ["sutta", "appearance", "negative_appearance", "live_sutta", "frequency180"]):
        add("preserve_prefix", prefix=prefix, expert=expert)
    for digit_penalty, sutta_penalty in itertools.product([0, .02, .1, .5], [0, .05, .25]):
        if digit_penalty or sutta_penalty:
            add("greedy_diversification", digit_penalty=digit_penalty, sutta_penalty=sutta_penalty)
    for gate, weight in itertools.product(["both_absent", "both_present", "sutta_top3", "sutta_top6", "xor"], [-20, -4, -1, 1, 4, 20]):
        add("constraint_tilt", gate=gate, weight=weight)
    for seed in range(5):
        add("random_control", seed=seed)
    return sorted(output.values(), key=lambda candidate: candidate.key())


def score(context: Context, candidate: Candidate) -> np.ndarray:
    r, p, family = context.replay, candidate.parameters, candidate.family
    base = context.base_log
    if family == "loglinear":
        return r.scores(context.channel, Weights(**p))
    if family in ("mixture", "rank_fusion", "consensus"):
        experts = p["experts"]
        weight = p.get("weight", 2 / 3)
        weights = np.array([1 - weight] + [weight / (len(experts) - 1)] * (len(experts) - 1))
        values = np.stack([context.expert(expert) for expert in experts])
        method = p["method"]
        if method == "arithmetic":
            return np.log(np.maximum(np.einsum("k,kep->ep", weights, values), 1e-12))
        if method == "geometric":
            return np.einsum("k,kep->ep", weights, np.log(values))
        if method == "harmonic":
            return -np.log(np.einsum("k,kep->ep", weights, 1 / values))
        if method in ("median", "minimum", "maximum"):
            function = {"median": np.median, "minimum": np.min, "maximum": np.max}[method]
            return np.log(function(values, axis=0))
        ranks = np.stack([context.ranks(expert) for expert in experts])
        if method == "borda":
            return -np.einsum("k,kep->ep", weights, ranks)
        if method.startswith("rrf"):
            return np.einsum("k,kep->ep", weights, 1 / (int(method[3:]) + ranks + 1))
        if method == "vote":
            return (ranks < 30).sum(axis=0) - .001 * ranks.mean(axis=0)
    if family == "historical_tilt":
        return base + p["weight"] * context.features[p["feature"]]
    if family == "transformed_digits":
        ch = r.channels[context.channel]
        probabilities = ch[p["target"]]
        indices = (np.arange(10) + p["amount"]) % 10 if p["transform"] == "rotate" else (p["amount"] - np.arange(10)) % 10
        transformed = probabilities[:, indices]
        if p["target"] == "sutta":
            residual = np.log(transformed / (context.q @ r.sutta_matrix))[:, r.sutta]
        else:
            residual = (logit(transformed) - logit(context.q @ r.digits)) @ r.digits.T
        return base + p["weight"] * residual
    if family == "nonlinear_interaction":
        return base + p["weight"] * centered(context.features[p["left"]]) * centered(context.features[p["right"]])
    if family == "regime_flip":
        direction = np.where(context.states[p["state"]] > p["threshold"], 1, -1)
        return base + direction[:, None] * p["weight"] * context.features[p["feature"]]
    if family == "sutta_buckets":
        within = np.empty_like(base)
        for kind, sutta in itertools.product(["SP", "DP", "TP"], range(10)):
            mask = (r.kind == kind) & (r.sutta == sutta)
            within[:, mask] = stable_ranks(base[:, mask])
        sr = stable_ranks(np.log(r.channels[context.channel]["sutta"]))[:, r.sutta]
        return -p["within"] * within - p["weight"] * sr + np.log(np.maximum(context.q, 1e-12)) * .001
    if family == "preserve_prefix":
        alternative = context.expert(p["expert"])
        ranks = stable_ranks(alternative)
        first = context.ranks("base") < p["prefix"]
        return np.where(first, 1000 - context.ranks("base"), -ranks)
    if family == "greedy_diversification":
        overlap = r.digits @ r.digits.T
        same = (r.sutta[:, None] == r.sutta[None, :]).astype(float)
        costs = p["digit_penalty"] * overlap + p["sutta_penalty"] * same
        current = base.copy()
        order_scores = np.empty_like(base)
        rows = np.arange(len(base))
        for rank in range(220):
            chosen = current.argmax(axis=1)
            order_scores[rows, chosen] = -rank
            current -= costs[chosen]
            current[rows, chosen] = -np.inf
        return order_scores
    if family == "constraint_tilt":
        if p["gate"] == "both_absent":
            mask = context.features["avoid"] == 0
        elif p["gate"] == "both_present":
            mask = context.features["present"] == 2
        elif p["gate"].startswith("sutta_top"):
            count = int(p["gate"].removeprefix("sutta_top"))
            mask = stable_ranks(r.channels[context.channel]["sutta"])[:, r.sutta] < count
        else:
            mask = (context.features["avoid"] == 0) ^ (context.features["present"] == 2)
        return base + p["weight"] * mask
    if family == "random_control":
        values = np.empty_like(base)
        for i, event in enumerate(r.rows):
            seed = int.from_bytes(hashlib.sha256(f"{event['date']}|{event['market']}|{p['seed']}".encode()).digest()[:8], "little")
            values[i] = np.random.default_rng(seed).random(220)
        return np.log(context.preserve_kind(values))
    if family == "ridge_stack":
        features = np.stack([centered(context.features[name]) for name in p["features"]], axis=2)
        if "oof_scores" in p:
            raise ValueError("OOF scores are local cache data, not a serializable policy")
        tilt = np.einsum("epf,f->ep", features, np.array(p["weights"]))
        result = (r.base(context.channel, 1)[0] if p["dp_only"] else base) + tilt
        if p["dp_only"]:
            out = base.copy()
            mask = r.kind == "DP"
            out[:, mask] = np.log(softmax(result[:, mask]) * context.q[:, mask].sum(axis=1, keepdims=True))
            return out
        return result
    raise ValueError(f"Unknown candidate {candidate}")
