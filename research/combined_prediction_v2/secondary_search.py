"""Separate Sutta, joint digit-pair, panel-kind and Jodi combination searches."""
from __future__ import annotations

import argparse
import bisect
import itertools
import json
from collections import defaultdict
from datetime import date

import numpy as np

from wide_models import HERE, PROTOCOL, Context, StudyReplay, history_rows, save_json, softmax, stable_ranks

PAIRS = list(itertools.combinations(range(10), 2))


def historical_experts(replay: StudyReplay, channel: str, records: list[dict]) -> dict:
    series = defaultdict(list)
    for row in records:
        if row["open"] in replay.panel_index and row["close"] in replay.panel_index:
            series[row["market"]].append(row)
    dates = {m: [r["date"] for r in rs] for m, rs in series.items()}
    output = {domain: defaultdict(list) for domain in ("sutta", "present", "absent", "kind", "jodi")}
    side = "open" if channel == "open" else "close"
    for event in replay.rows:
        rs = series[event["market"]]
        a = bisect.bisect_left(dates[event["market"]], event["historyCutoff"])
        b = bisect.bisect_left(dates[event["market"]], event["date"])
        prior = rs[a:b]
        for window in (7, 30, 90, 180):
            history = prior[-window:]
            idx = np.array([replay.panel_index[r[side]] for r in history])
            suttas = replay.sutta[idx]
            output["sutta"][f"history{window}"].append((np.bincount(suttas, minlength=10) + 2) / (len(idx) + 20))
            output["present"][f"history{window}"].append((replay.pair_present[idx].sum(axis=0) + 1) / (len(idx) + 20))
            output["absent"][f"history{window}"].append((replay.pair_absent[idx].sum(axis=0) + 10) / (len(idx) + 20))
            kinds = np.array([("SP", "DP", "TP").index(k) for k in replay.kind[idx]])
            output["kind"][f"history{window}"].append((np.bincount(kinds, minlength=3) + np.array([15, 5, .1])) / (len(idx) + 20.1))
            pairs = np.array([(sum(map(int, r["open"])) % 10) * 10 + sum(map(int, r["close"])) % 10 for r in history])
            output["jodi"][f"history{window}"].append((np.bincount(pairs, minlength=100) + 1) / (len(pairs) + 100))
        weekday = date.fromisoformat(event["date"]).weekday()
        same_weekday = [r for r in prior if date.fromisoformat(r["date"]).weekday() == weekday]
        pairs = np.array([(sum(map(int, r["open"])) % 10) * 10 + sum(map(int, r["close"])) % 10 for r in same_weekday], dtype=int)
        output["jodi"]["weekday"].append((np.bincount(pairs, minlength=100) + 1) / (len(pairs) + 100))
        if channel == "close_known":
            open_kind = len(set(event["actualOpen"]))
            conditioned = [r for r in prior if len(set(r["open"])) == open_kind]
        else:
            previous_kind = len(set(prior[-1][side]))
            conditioned = [prior[i] for i in range(1, len(prior)) if len(set(prior[i-1][side])) == previous_kind]
        counts = np.zeros(3)
        for row in conditioned:
            counts[("SP", "DP", "TP").index(replay.kind[replay.panel_index[row[side]]])] += 1
        output["kind"]["conditional_kind"].append((counts + np.array([37.5, 12.4, .1])) / (len(conditioned) + 50))
    return {domain: {k: np.array(v) for k, v in values.items()} for domain, values in output.items()}


def make_experts(context: Context, records: list[dict]) -> dict:
    r, channel = context.replay, context.channel
    output = historical_experts(r, channel, records)
    native = r.channels[channel]
    output["sutta"]["native"] = native["sutta"]
    for domain, key in (("present", "present"), ("absent", "avoid")):
        value = np.zeros((len(r.rows), 45))
        for i, pair in enumerate(native[key]):
            value[i, PAIRS.index(tuple(sorted(pair)))] = 1
        output[domain]["native"] = value
        digit = native["appearance"] if domain == "present" else 1 - native["appearance"]
        output[domain]["marginal_independence"] = np.stack([digit[:, a] * digit[:, b] for a, b in PAIRS], axis=1)
    output["kind"]["native"] = np.broadcast_to([1., 0., 0.], (len(r.rows), 3)).copy()
    for expert in ("base", "sutta", "appearance", "conditional", "frequency180", "live_sutta", "live_digits", "negative_appearance"):
        q = context.expert(expert)
        output["sutta"]["panel_" + expert] = q @ r.sutta_matrix
        output["present"]["panel_" + expert] = q @ r.pair_present
        output["absent"]["panel_" + expert] = q @ r.pair_absent
        output["kind"]["panel_" + expert] = np.stack([q[:, r.kind == kind].sum(axis=1) for kind in ("SP", "DP", "TP")], axis=1)
    for amount in (1, 3, 5, 7, 9):
        output["sutta"][f"rotate{amount}"] = np.roll(native["sutta"], amount, axis=1)
    output["sutta"]["mirror9"] = native["sutta"][:, ::-1]
    for domain in ("present", "absent"):
        raw = output[domain]["marginal_independence"]
        output[domain]["contrarian"] = np.maximum(raw.max(axis=1, keepdims=True) + raw.min(axis=1, keepdims=True) - raw, 1e-9)
        for amount in (3, 5):
            indices = [PAIRS.index(tuple(sorted(((a + amount) % 10, (b + amount) % 10)))) for a, b in PAIRS]
            output[domain][f"rotate{amount}"] = raw[:, indices]
    op = r.channels["open"]["sutta"]
    cp = r.channels["close_pre"]["sutta"]
    output["jodi"]["native"] = (op[:, :, None] * cp[:, None, :]).reshape(-1, 100)
    output["jodi"]["conditional"] = (op[:, :, None] * r.conditional).reshape(-1, 100)
    output["jodi"]["mirror_close"] = (op[:, :, None] * cp[:, None, ::-1]).reshape(-1, 100)
    output["jodi"]["opposite_close"] = (op[:, :, None] * np.roll(cp, 5, axis=1)[:, None, :]).reshape(-1, 100)
    # A normalized ranking vector permits mixing one-hot public pair choices
    # and joint event frequencies. These are ranking weights, not calibration.
    for experts in output.values():
        for name, values in experts.items():
            values = np.maximum(values, 1e-9)
            experts[name] = values / values.sum(axis=1, keepdims=True)
    return output


def specs(experts: dict, domain: str) -> list[dict]:
    output = [{"method": "single", "experts": [name], "weight": 1.} for name in experts]
    for expert in experts:
        if expert == "native":
            continue
        for weight, method in itertools.product([.1, .25, .5, .75, 1, 2], ["arithmetic", "geometric", "rrf"]):
            output.append({"method": method, "experts": ["native", expert], "weight": weight})
    for a, b in itertools.combinations([name for name in experts if name.startswith("history") or name in ("panel_base", "panel_appearance", "conditional")], 2):
        output.append({"method": "consensus", "experts": ["native", a, b], "weight": 1 / 3})
    if domain == "jodi":
        for o, c, weight in itertools.product([0, 1, 3, 5], [0, 1, 3, 5], [-2, -.5, .5, 2]):
            output.append({"method": "pair_rotation", "experts": ["native"], "weight": weight, "open_rotation": o, "close_rotation": c})
    return output


def predict(experts: dict, spec: dict) -> np.ndarray:
    values = np.stack([experts[name] for name in spec["experts"]])
    method, weight = spec["method"], spec["weight"]
    if method == "single":
        return values[0]
    if method == "arithmetic":
        # Values beyond 1 deliberately extrapolate; clipping is explicit.
        return np.maximum((1 - weight) * values[0] + weight * values[1], 1e-12)
    if method == "geometric":
        return (1 - weight) * np.log(values[0]) + weight * np.log(values[1])
    if method == "rrf":
        ranks = [stable_ranks(v) for v in values]
        return (1 - weight) / (30 + ranks[0] + 1) + weight / (30 + ranks[1] + 1)
    if method == "consensus":
        return np.log(values).mean(axis=0)
    if method == "pair_rotation":
        raw = values[0].reshape(-1, 10, 10)
        transformed = np.roll(np.roll(raw, spec["open_rotation"], axis=1), spec["close_rotation"], axis=2)
        return ((1 - weight) * np.log(raw) + weight * np.log(transformed)).reshape(-1, 100)
    raise ValueError(method)


def hits(replay: StudyReplay, channel: str, task: str, values: np.ndarray) -> np.ndarray:
    actual = replay.actual(channel)
    if task.startswith("sutta"):
        n = int(task.removeprefix("sutta"))
        picks = np.argsort(-values, axis=1, kind="stable")[:, :n]
        return (picks == replay.sutta[actual][:, None]).any(axis=1)
    if task in ("present2", "absent2"):
        picks = np.argmax(values, axis=1)
        masks = replay.pair_present if task == "present2" else replay.pair_absent
        return masks[actual, picks].astype(bool)
    if task == "kind":
        actual_kind = np.array([("SP", "DP", "TP").index(k) for k in replay.kind[actual]])
        return values.argmax(axis=1) == actual_kind
    if task.startswith("jodi"):
        count = int(task.removeprefix("jodi"))
        actual_pair = replay.sutta[replay.actual_open] * 10 + replay.sutta[replay.actual_close]
        picks = np.argsort(-values, axis=1, kind="stable")[:, :count]
        return (picks == actual_pair[:, None]).any(axis=1)
    raise ValueError(task)


def native_hits(replay: StudyReplay, channel: str, task: str, experts: dict) -> np.ndarray:
    if task.startswith("jodi"):
        count = int(task.removeprefix("jodi"))
        width = int(np.sqrt(count))
        op = np.array([r["productionSuttas"]["open"][:width] for r in replay.rows])
        cp = np.array([r["productionSuttas"]["close"][:width] for r in replay.rows])
        return (op == replay.sutta[replay.actual_open][:, None]).any(axis=1) & (cp == replay.sutta[replay.actual_close][:, None]).any(axis=1)
    return hits(replay, channel, task, experts["native"])


def build() -> None:
    replay = StudyReplay()
    records = history_rows()
    output = {}
    summary = []
    for channel in PROTOCOL["channels"]:
        context = Context(replay, channel, records)
        all_experts = make_experts(context, records)
        tasks = {"sutta": ["sutta3", "sutta6"], "present": ["present2"], "absent": ["absent2"], "kind": ["kind"]}
        if channel == "open":
            tasks["jodi"] = ["jodi25", "jodi36"]
        output[channel] = {}
        for domain, task_names in tasks.items():
            expert = all_experts[domain]
            candidates = specs(expert, domain)
            scores = [predict(expert, spec) for spec in candidates]
            for task in task_names:
                result = np.stack([hits(replay, channel, task, values) for values in scores])
                baseline = native_hits(replay, channel, task, expert)
                delta = result.astype(float) - baseline
                block_mean = np.stack([delta[:, (replay.dates >= a) & (replay.dates <= b)].mean(axis=1) for a, b in PROTOCOL["blocks"]], axis=1)
                stability = delta.mean(axis=1) - .5 * block_mean.std(axis=1)
                mean_index = int(delta.mean(axis=1).argmax())
                stable_index = int(stability.argmax())
                route = {}
                for market in sorted(set(replay.markets)):
                    mask = replay.markets == market
                    local = delta[:, mask].sum(axis=1)
                    pooled = delta.mean(axis=1)
                    posterior = (local + 100 * pooled) / (mask.sum() + 100)
                    local_blocks = np.stack([delta[:, mask & (replay.dates >= a) & (replay.dates <= b)].sum(axis=1) for a, b in PROTOCOL["blocks"]], axis=1)
                    valid = ((local_blocks > 0).sum(axis=1) >= 2) & (local >= 3) & (local_blocks.min(axis=1) >= -2)
                    valid[stable_index] = True
                    route[market] = int(np.where(valid, posterior, -np.inf).argmax())
                output[channel][task] = {"domain": domain, "catalogue": candidates, "mean": mean_index if delta.mean(axis=1).max() > 0 else None, "stable": stable_index if stability.max() > 0 else None, "market_routes": route if stability.max() > 0 else {}, "baseline_hits": int(baseline.sum()), "candidate_count": len(candidates)}
                for i, spec in enumerate(candidates):
                    summary.append([channel, task, i, spec["method"], "+".join(spec["experts"]), spec["weight"], int(result[i].sum()), len(baseline), *block_mean[i].tolist(), int((np.stack([delta[:, replay.markets == m].mean(axis=1) for m in sorted(set(replay.markets))], axis=1)[i] > 0).sum())])
                print(f"Secondary {channel} {task}: {len(candidates)} candidates", flush=True)
    save_json(HERE / "secondary_policy.json", output)
    import csv
    with (HERE / "secondary_search.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["channel", "task", "candidate", "method", "experts", "weight", "hits", "n", "block1_lift", "block2_lift", "block3_lift", "markets_positive"])
        writer.writerows(summary)


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    build()
