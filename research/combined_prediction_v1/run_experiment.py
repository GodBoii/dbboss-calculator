"""Select on earlier dates, freeze the policy, then audit once on later dates.

Run `select` before `evaluate`. All inputs and outputs stay in this directory.
The study is retrospective; protocol.json records existing base-model reuse.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import itertools
import json
import math
from dataclasses import asdict, dataclass, replace
from pathlib import Path

import numpy as np
from scipy.stats import binomtest

HERE = Path(__file__).resolve().parent
PROTOCOL = json.loads((HERE / "protocol.json").read_text())
PAIRS = list(itertools.combinations(range(10), 2))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def softmax(scores: np.ndarray) -> np.ndarray:
    weights = np.exp(scores - scores.max(axis=-1, keepdims=True))
    return weights / weights.sum(axis=-1, keepdims=True)


def logit(probabilities: np.ndarray) -> np.ndarray:
    p = np.clip(probabilities, 1e-6, 1 - 1e-6)
    return np.log(p) - np.log1p(-p)


@dataclass(frozen=True, order=True)
class Weights:
    sutta: float = 0.0
    appearance: float = 0.0
    avoid_multiplier: float = 1.0
    present_multiplier: float = 1.0
    dp_blend: float = 0.0
    conditional_close: float = 0.0

    def complexity(self, baseline: Weights) -> float:
        return sum(abs(a - b) for a, b in zip(asdict(self).values(), asdict(baseline).values()))

    def label(self) -> str:
        return ";".join(f"{key}={value:g}" for key, value in asdict(self).items())

    def family(self) -> str:
        active = [name for name, value in asdict(self).items()
                  if value != (1.0 if name.endswith("multiplier") else 0.0)]
        return "+".join(active) if active else "baseline"


class Replay:
    def __init__(self, *, include_audit: bool) -> None:
        meta_path = HERE / "replay_metadata.json"
        self.meta = json.loads(meta_path.read_text())
        if self.meta["protocolSHA256"] != digest(HERE / "protocol.json"):
            raise ValueError("Replay protocol changed; regenerate the replay")
        with gzip.open(HERE / "replay.jsonl.gz", "rb") as handle:
            raw = handle.read()
        if hashlib.sha256(raw).hexdigest() != self.meta["replaySHA256"]:
            raise ValueError("Replay hash mismatch")
        rows = [json.loads(line) for line in raw.splitlines()]
        if not include_audit:
            rows = [row for row in rows if row["date"] <= PROTOCOL["validation_end"]]
        self.rows = rows
        self.dates = np.array([r["date"] for r in rows])
        self.markets = np.array([r["market"] for r in rows])
        self.panels = self.meta["panelOrder"]
        self.panel_index = {p: i for i, p in enumerate(self.panels)}
        self.digits = np.array([[float(str(d) in panel) for d in range(10)] for panel in self.panels])
        self.sutta = np.array([sum(map(int, panel)) % 10 for panel in self.panels])
        self.kind = np.array(["SP" if len(set(p)) == 3 else "DP" if len(set(p)) == 2 else "TP" for p in self.panels])
        self.dp_index = np.array([self.panel_index[p] for p in self.meta["dpOrder"]])
        self.sutta_matrix = np.eye(10)[self.sutta]
        self.pair_present = np.array([self.digits[:, a] * self.digits[:, b] for a, b in PAIRS]).T
        self.pair_absent = np.array([(1 - self.digits[:, a]) * (1 - self.digits[:, b]) for a, b in PAIRS]).T
        self.development = self.dates <= PROTOCOL["development_end"]
        self.validation = (self.dates > PROTOCOL["development_end"]) & (self.dates <= PROTOCOL["validation_end"])
        self.audit = self.dates > PROTOCOL["validation_end"]
        self.actual_open = np.array([self.panel_index[r["actualOpen"]] for r in rows])
        self.actual_close = np.array([self.panel_index[r["actualClose"]] for r in rows])
        self.conditional = np.array([r["conditionalClose"] for r in rows])
        self.channels = {}
        for name in PROTOCOL["channels"]:
            values = [row["channels"][name] for row in rows]
            avoid = np.array([v["avoid"] for v in values])
            present = np.array([v["present"] for v in values])
            self.channels[name] = {
                "base": softmax(np.array([v["logits"] for v in values])),
                "dp": np.array([v["dpProbabilities"] for v in values]),
                "sutta": np.array([v["sutta"] for v in values]),
                "appearance": np.array([v["appearance"] for v in values]),
                "conditional": np.array([v["conditionalSutta"] for v in values]),
                "avoid": avoid,
                "present": present,
                "avoid_count": np.array([self.digits[:, pair].sum(axis=1) for pair in avoid]),
                "present_count": np.array([self.digits[:, pair].sum(axis=1) for pair in present]),
            }
        for row in rows:
            if row["historyMaxDate"] >= row["date"]:
                raise ValueError("Target/future history leakage")
        self._base_cache: dict[tuple[str, float], tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]] = {}

    def actual(self, channel: str) -> np.ndarray:
        return self.actual_open if channel == "open" else self.actual_close

    def base(self, channel: str, blend: float) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        key = channel, blend
        if key not in self._base_cache:
            ch = self.channels[channel]
            q = ch["base"].copy()
            mass = q[:, self.dp_index].sum(axis=1, keepdims=True)
            q[:, self.dp_index] = (1 - blend) * q[:, self.dp_index] + blend * mass * ch["dp"]
            q = np.clip(q, 1e-12, None)
            q /= q.sum(axis=1, keepdims=True)
            sutta_mass = q @ self.sutta_matrix
            sutta_residual = np.log(ch["sutta"] / sutta_mass)[:, self.sutta]
            appearance_residual = (logit(ch["appearance"]) - logit(q @ self.digits)) @ self.digits.T
            conditional_residual = np.log(ch["conditional"] / sutta_mass)[:, self.sutta]
            self._base_cache[key] = np.log(q), sutta_residual, appearance_residual, conditional_residual
        return self._base_cache[key]

    def scores(self, channel: str, weights: Weights) -> np.ndarray:
        base, sutta, appearance, conditional = self.base(channel, weights.dp_blend)
        ch = self.channels[channel]
        return (base + weights.sutta * sutta + weights.appearance * appearance
                + math.log(weights.avoid_multiplier) * ch["avoid_count"]
                + math.log(weights.present_multiplier) * ch["present_count"]
                + weights.conditional_close * conditional)

    def hits(self, channel: str, task: str, scores: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        kind, count = PROTOCOL["panel_tasks"][task]
        actual = self.actual(channel)
        allowed = np.ones(len(self.panels), dtype=bool) if kind == "all" else self.kind == kind
        eligible = np.ones(len(actual), dtype=bool) if kind == "all" else self.kind[actual] == kind
        actual_score = scores[np.arange(len(actual)), actual]
        ahead = (scores > actual_score[:, None]) | ((scores == actual_score[:, None]) & (np.arange(len(self.panels))[None, :] < actual[:, None]))
        ranks = 1 + (ahead & allowed[None, :]).sum(axis=1)
        return (ranks <= count) & eligible, eligible


def baseline_for(task: str) -> Weights:
    return Weights(dp_blend=1.0 if task.startswith("dp") else 0.0)


def rate(hits: np.ndarray, eligible: np.ndarray, mask: np.ndarray) -> float:
    use = eligible & mask
    return float(hits[use].mean()) if use.any() else 0.0


def counts(hits: np.ndarray, eligible: np.ndarray, mask: np.ndarray) -> dict:
    use = eligible & mask
    return {"hits": int(hits[use].sum()), "n": int(use.sum()), "rate": rate(hits, eligible, mask)}


def candidates(channel: str) -> list[Weights]:
    grid = PROTOCOL["coarse_grid"]
    values = {key: grid[key] for key in asdict(Weights()) if key != "conditional_close" or channel != "open"}
    out = {Weights(), Weights(dp_blend=1)}
    for names_count in (1, 2):
        for names in itertools.combinations(values, names_count):
            for choice in itertools.product(*(values[name] for name in names)):
                out.add(replace(Weights(), **dict(zip(names, choice))))
    # Test bounded three/four-signal mixtures, rather than unrestricted products.
    for s, a, avoid, present, dp in itertools.product([0.25, 0.5, 1], [0, 0.25, 0.5], [0.5, 0.75, 1], [1, 1.25, 1.5], [0, 1]):
        out.add(Weights(s, a, avoid, present, dp, 0))
    return sorted(out)


def refinement(leaders: list[Weights], channel: str) -> set[Weights]:
    out = set()
    for leader in leaders:
        for key, value in asdict(leader).items():
            if key == "conditional_close" and channel == "open":
                continue
            offsets = PROTOCOL["refinement"]["log_multiplier_offsets"] if key.endswith("multiplier") else PROTOCOL["refinement"]["weight_offsets"]
            for delta in offsets:
                changed = value * math.exp(delta) if key.endswith("multiplier") else value + delta
                if key == "dp_blend" and not 0 <= changed <= 1:
                    continue
                if key == "conditional_close" and changed < 0:
                    continue
                if key in ("sutta", "appearance") and not -0.5 <= changed <= 2:
                    continue
                out.add(replace(leader, **{key: round(changed, 8)}))
    return out


def evaluate_candidates(replay: Replay, channel: str, choices: list[Weights]) -> list[dict]:
    rows = []
    for weights in choices:
        scores = replay.scores(channel, weights)
        metrics = {}
        for task in PROTOCOL["panel_tasks"]:
            hits, eligible = replay.hits(channel, task, scores)
            metrics[task] = {"development": counts(hits, eligible, replay.development)}
        rows.append({"weights": asdict(weights), "label": weights.label(), "family": weights.family(), "metrics": metrics})
    return rows


def choose_routes(replay: Replay, channel: str, task: str, choices: list[Weights], global_weights: Weights) -> dict:
    guard = PROTOCOL["market_route"]
    global_scores = replay.scores(channel, global_weights)
    global_hits, eligible = replay.hits(channel, task, global_scores)
    routes = {}
    predictions = [replay.hits(channel, task, replay.scores(channel, w))[0] for w in choices]
    for market in sorted(set(replay.markets)):
        dev = replay.development & (replay.markets == market) & eligible
        val = replay.validation & (replay.markets == market) & eligible
        if dev.sum() < guard["minimum_development_events"] or val.sum() < guard["minimum_validation_events"]:
            continue
        best = min(range(len(choices)), key=lambda i: (-int(predictions[i][dev].sum()), choices[i].complexity(global_weights)))
        dev_gain = int(predictions[best][dev].sum() - global_hits[dev].sum())
        val_gain = int(predictions[best][val].sum() - global_hits[val].sum())
        if dev_gain >= guard["minimum_development_net_hits"] and val_gain >= guard["minimum_validation_net_hits"]:
            routes[market] = {"weights": asdict(choices[best]), "development_net_hits": dev_gain, "validation_net_hits": val_gain}
    return routes


def select() -> None:
    replay = Replay(include_audit=False)
    selected = {"protocolSHA256": digest(HERE / "protocol.json"), "replaySHA256": replay.meta["replaySHA256"], "channels": {}}
    search_rows = []
    for channel in PROTOCOL["channels"]:
        coarse = candidates(channel)
        rows = evaluate_candidates(replay, channel, coarse)
        leaders = set()
        for task in PROTOCOL["panel_tasks"]:
            ordered = sorted(rows, key=lambda row: (-row["metrics"][task]["development"]["rate"], Weights(**row["weights"]).complexity(baseline_for(task))))
            leaders.update(Weights(**r["weights"]) for r in ordered[:PROTOCOL["refinement"]["development_leaders_per_task"]])
        refined = sorted(refinement(list(leaders), channel) - set(coarse))
        rows += evaluate_candidates(replay, channel, refined)
        selected["channels"][channel] = {"searched": len(rows), "tasks": {}}
        for task in PROTOCOL["panel_tasks"]:
            baseline = baseline_for(task)
            baseline_hits, eligible = replay.hits(channel, task, replay.scores(channel, baseline))
            dev_base = rate(baseline_hits, eligible, replay.development)
            ordered = sorted(rows, key=lambda row: (-row["metrics"][task]["development"]["rate"], Weights(**row["weights"]).complexity(baseline)))
            shortlist = [Weights(**row["weights"]) for row in ordered[:12] if row["metrics"][task]["development"]["rate"] >= dev_base]
            # Also inspect one development-selected leader from every family.
            family_leaders = {}
            for row in ordered:
                family_leaders.setdefault(row["family"], Weights(**row["weights"]))
            evaluated = sorted(set(shortlist + [baseline] + list(family_leaders.values())))
            val_metrics = {}
            for w in evaluated:
                hits, eligible = replay.hits(channel, task, replay.scores(channel, w))
                val_metrics[w] = {"development": counts(hits, eligible, replay.development), "validation": counts(hits, eligible, replay.validation)}
            eligible_choices = [w for w in evaluated if val_metrics[w]["development"]["rate"] >= dev_base]
            best = min(eligible_choices, key=lambda w: (-val_metrics[w]["validation"]["rate"], w.complexity(baseline), -val_metrics[w]["development"]["rate"]))
            routes = choose_routes(replay, channel, task, evaluated, best)
            selected["channels"][channel]["tasks"][task] = {
                "baseline": asdict(baseline), "selected": asdict(best), **val_metrics[best],
                "baseline_development": counts(baseline_hits, eligible, replay.development),
                "baseline_validation": counts(baseline_hits, eligible, replay.validation),
                "market_routes": routes,
                "family_leaders": [{"family": name, "weights": asdict(w), **val_metrics[w]} for name, w in family_leaders.items()],
            }
        search_rows += [{"channel": channel, **row} for row in rows]
        print(f"Selected {channel}: {len(rows)} configurations, development/validation only", flush=True)
    selected["jodi"] = select_jodi(replay)
    write_json(HERE / "selection.json", selected)
    write_json(HERE / "selection_manifest.json", {"selectionSHA256": digest(HERE / "selection.json"), "protocolSHA256": digest(HERE / "protocol.json")})
    with (HERE / "search_development.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["channel", "weights", "family", *PROTOCOL["panel_tasks"]])
        for row in search_rows:
            writer.writerow([row["channel"], row["label"], row["family"], *[row["metrics"][t]["development"]["rate"] for t in PROTOCOL["panel_tasks"]]])
    print(f"Selection frozen: {digest(HERE / 'selection.json')}", flush=True)


def jodi_scores(replay: Replay, weight: float) -> np.ndarray:
    op = replay.channels["open"]["sutta"]
    cp = replay.channels["close_pre"]["sutta"]
    return np.log(op[:, :, None]) + np.log(cp[:, None, :]) + weight * (np.log(replay.conditional) - np.log(cp[:, None, :]))


def jodi_hits(replay: Replay, scores: np.ndarray, count: int) -> np.ndarray:
    actual = replay.sutta[replay.actual_open] * 10 + replay.sutta[replay.actual_close]
    flat = scores.reshape(len(actual), 100)
    act = flat[np.arange(len(actual)), actual]
    ranks = 1 + ((flat > act[:, None]) | ((flat == act[:, None]) & (np.arange(100)[None, :] < actual[:, None]))).sum(axis=1)
    return ranks <= count


def grid_hits(replay: Replay, count: int) -> np.ndarray:
    width = int(math.isqrt(count))
    op = np.array([r["productionSuttas"]["open"][:width] for r in replay.rows])
    cp = np.array([r["productionSuttas"]["close"][:width] for r in replay.rows])
    return (op == replay.sutta[replay.actual_open][:, None]).any(axis=1) & (cp == replay.sutta[replay.actual_close][:, None]).any(axis=1)


def select_jodi(replay: Replay) -> dict:
    out = {}
    for count in PROTOCOL["jodi"]["counts"]:
        base = grid_hits(replay, count)
        eligible = np.ones(len(base), dtype=bool)
        options = []
        for w in PROTOCOL["jodi"]["conditional_weights"]:
            hits = jodi_hits(replay, jodi_scores(replay, w), count)
            options.append({"conditional_weight": w, "development": counts(hits, eligible, replay.development), "validation": counts(hits, eligible, replay.validation)})
        qualified = [o for o in options if o["development"]["rate"] >= rate(base, eligible, replay.development) and o["validation"]["rate"] > rate(base, eligible, replay.validation)]
        best = min(qualified, key=lambda o: (-o["validation"]["rate"], o["conditional_weight"])) if qualified else None
        out[str(count)] = {"selected_weight": best["conditional_weight"] if best else None, "development": counts(base, eligible, replay.development), "validation": counts(base, eligible, replay.validation), "candidates": options}
    return out


def paired(replay: Replay, baseline: np.ndarray, candidate: np.ndarray, eligible: np.ndarray, mask: np.ndarray) -> dict:
    use = eligible & mask
    if not use.any():
        return {"n": 0, "baseline_hits": 0, "candidate_hits": 0, "lift_pp": 0.0, "day_bootstrap95_pp": [0.0, 0.0], "paired_p": 1.0}
    b, c = baseline[use], candidate[use]
    delta = c.astype(float) - b.astype(float)
    dates = replay.dates[use]
    unique = np.unique(dates)
    day_n = np.array([(dates == d).sum() for d in unique])
    day_sum = np.array([delta[dates == d].sum() for d in unique])
    rng = np.random.default_rng(PROTOCOL["seed"])
    indices = rng.integers(0, len(unique), size=(PROTOCOL["bootstrap_samples"], len(unique)))
    draws = day_sum[indices].sum(axis=1) / day_n[indices].sum(axis=1)
    wins = int(((~b) & c).sum())
    losses = int((b & (~c)).sum())
    p = float(binomtest(wins, wins + losses).pvalue) if wins + losses else 1.0
    return {"n": len(b), "baseline_hits": int(b.sum()), "candidate_hits": int(c.sum()),
            "baseline_rate": float(b.mean()), "candidate_rate": float(c.mean()),
            "lift_pp": float(100 * delta.mean()), "day_bootstrap95_pp": (100 * np.quantile(draws, [0.025, 0.975])).tolist(),
            "candidate_only": wins, "baseline_only": losses, "paired_p": p,
            "unconditional_candidate_rate": float(candidate[mask].mean())}


def derived_hits(replay: Replay, channel: str, scores: np.ndarray) -> dict[str, np.ndarray]:
    q = softmax(scores)
    actual = replay.actual(channel)
    sp = q @ replay.sutta_matrix
    order = np.argsort(-sp, axis=1, kind="stable")
    actual_sutta = replay.sutta[actual]
    present = np.argmax(q @ replay.pair_present, axis=1)
    absent = np.argmax(q @ replay.pair_absent, axis=1)
    kind_probs = np.stack([q[:, replay.kind == k].sum(axis=1) for k in ("SP", "DP", "TP")], axis=1)
    actual_kind = np.array([("SP", "DP", "TP").index(k) for k in replay.kind[actual]])
    return {"sutta3": (order[:, :3] == actual_sutta[:, None]).any(axis=1),
            "sutta6": (order[:, :6] == actual_sutta[:, None]).any(axis=1),
            "present2": replay.pair_present[actual, present].astype(bool),
            "absent2": replay.pair_absent[actual, absent].astype(bool),
            "kind": kind_probs.argmax(axis=1) == actual_kind}


def evaluate() -> None:
    manifest = json.loads((HERE / "selection_manifest.json").read_text())
    if manifest["selectionSHA256"] != digest(HERE / "selection.json") or manifest["protocolSHA256"] != digest(HERE / "protocol.json"):
        raise ValueError("Selection/protocol changed after freezing")
    selection = json.loads((HERE / "selection.json").read_text())
    replay = Replay(include_audit=True)
    if selection["replaySHA256"] != replay.meta["replaySHA256"]:
        raise ValueError("Replay changed after selection")
    results = {"selectionSHA256": manifest["selectionSHA256"], "protocolSHA256": manifest["protocolSHA256"],
               "rows": len(replay.rows), "block_counts": {"development": int(replay.development.sum()), "validation": int(replay.validation.sum()), "audit": int(replay.audit.sum())}, "channels": {}, "jodi": {}}
    ledger = []
    comparison_rows = []
    for channel in PROTOCOL["channels"]:
        results["channels"][channel] = {}
        for task, spec in selection["channels"][channel]["tasks"].items():
            base_weights, weights = Weights(**spec["baseline"]), Weights(**spec["selected"])
            base_scores, scores = replay.scores(channel, base_weights), replay.scores(channel, weights)
            baseline, eligible = replay.hits(channel, task, base_scores)
            candidate, _ = replay.hits(channel, task, scores)
            routed_scores = scores.copy()
            for market, route in spec["market_routes"].items():
                mask = replay.markets == market
                routed_scores[mask] = replay.scores(channel, Weights(**route["weights"]))[mask]
            routed, _ = replay.hits(channel, task, routed_scores)
            row = {"weights": asdict(weights), "routes": spec["market_routes"], "blocks": {}}
            for name, mask in (("development", replay.development), ("validation", replay.validation), ("audit", replay.audit), ("all_descriptive", np.ones(len(baseline), dtype=bool))):
                row["blocks"][name] = {"global": paired(replay, baseline, candidate, eligible, mask), "routed": paired(replay, baseline, routed, eligible, mask)}
            row["audit_by_market"] = {market: paired(replay, baseline, candidate, eligible, replay.audit & (replay.markets == market)) for market in sorted(set(replay.markets))}
            for variant in ("global", "routed"):
                comparison_rows.append((channel, task, variant, row["blocks"]["audit"][variant]))
            results["channels"][channel][task] = row
            kind, k = PROTOCOL["panel_tasks"][task]
            allowed = np.arange(len(replay.panels)) if kind == "all" else np.flatnonzero(replay.kind == kind)
            for i in np.flatnonzero(replay.audit):
                picks = allowed[np.argsort(-scores[i, allowed], kind="stable")[:k]]
                routed_picks = allowed[np.argsort(-routed_scores[i, allowed], kind="stable")[:k]]
                ledger.append([replay.dates[i], replay.markets[i], channel, task, replay.panels[replay.actual(channel)[i]], int(eligible[i]), int(baseline[i]), int(candidate[i]), int(routed[i]), " ".join(replay.panels[p] for p in picks), " ".join(replay.panels[p] for p in routed_picks)])
        # Freeze-derived diagnostics use the selected all30 policy; these are not
        # separately optimized on the final block.
        weights = Weights(**selection["channels"][channel]["tasks"]["all30"]["selected"])
        derived = derived_hits(replay, channel, replay.scores(channel, weights))
        actual = replay.actual(channel)
        side = "open" if channel == "open" else "close"
        production_order = np.array([r["productionSuttas"][side] for r in replay.rows])
        production = {
            "sutta3": (production_order[:, :3] == replay.sutta[actual][:, None]).any(axis=1),
            "sutta6": (production_order[:, :6] == replay.sutta[actual][:, None]).any(axis=1),
            "present2": np.array([all(str(d) in replay.panels[actual[i]] for d in pair) for i, pair in enumerate(replay.channels[channel]["present"])]),
            "absent2": np.array([all(str(d) not in replay.panels[actual[i]] for d in pair) for i, pair in enumerate(replay.channels[channel]["avoid"])]),
            "kind": replay.kind[actual] == "SP",
        }
        results["channels"][channel]["derived"] = {name: paired(replay, production[name], hits, np.ones(len(hits), dtype=bool), replay.audit) for name, hits in derived.items()}
        print(f"Audited {channel}", flush=True)
    for count in PROTOCOL["jodi"]["counts"]:
        base = grid_hits(replay, count)
        w = selection["jodi"][str(count)]["selected_weight"]
        hits = base if w is None else jodi_hits(replay, jodi_scores(replay, w), count)
        results["jodi"][str(count)] = {"conditional_weight": w, "audit": paired(replay, base, hits, np.ones(len(hits), dtype=bool), replay.audit)}
    # Holm adjustment across all 36 selected panel comparisons. It does not
    # eliminate historical base-model reuse or make this a prospective trial.
    ordered = sorted(comparison_rows, key=lambda item: item[3]["paired_p"])
    previous = 0.0
    for rank, (_, _, _, stats) in enumerate(ordered):
        previous = max(previous, min(1.0, (len(ordered) - rank) * stats["paired_p"]))
        stats["holm_p"] = previous
    write_json(HERE / "results.json", results)
    with (HERE / "audit_calls.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "market", "channel", "task", "actual", "actual_kind_eligible", "baseline_hit", "global_hit", "routed_hit", "global_panels", "routed_panels"])
        writer.writerows(ledger)
    render_report(results, selection)
    print("Final audit saved. No model or weight was changed using audit results.", flush=True)


def render_report(results: dict, selection: dict) -> None:
    lines = ["# Combined prediction experiment", "", "Research only. Production code is unchanged.", "",
             f"Source dates: {PROTOCOL['start']} through {PROTOCOL['end']}. {results['rows']} matched market-date events, all twelve markets and available weekends.", "",
             f"Development ends {PROTOCOL['development_end']}; validation ends {PROTOCOL['validation_end']}; final audit is 2026-09-08 through {PROTOCOL['end']}.",
             f"Event counts: {results['block_counts']}.", "", "## Evidence limits", ""]
    lines += [f"- {item}" for item in PROTOCOL["limitations"]]
    lines += ["", "Intervals resample whole dates, 10,000 replicates. McNemar p-values compare paired discordant outcomes. Holm p-values adjust the 36 selected global/routed panel comparisons. Market rows and secondary derived outputs are descriptive.", "",
              "## Final paired audit", "", "SP/DP rates below are conditional on the actual panel type; all10/all30 rates use every event. Lists always have the requested number of unique legal panels.", "",
              "| Channel | Task | Baseline | Selected | Net hits | Lift pp | Date-bootstrap 95% pp | Holm p |", "|---|---|---:|---:|---:|---:|---|---:|"]
    for channel in PROTOCOL["channels"]:
        for task in PROTOCOL["panel_tasks"]:
            s = results["channels"][channel][task]["blocks"]["audit"]["global"]
            lo, hi = s["day_bootstrap95_pp"]
            lines.append(f"| {channel} | {task} | {s['baseline_hits']}/{s['n']} ({100*s['baseline_rate']:.1f}%) | {s['candidate_hits']}/{s['n']} ({100*s['candidate_rate']:.1f}%) | {s['candidate_hits']-s['baseline_hits']:+d} | {s['lift_pp']:+.2f} | [{lo:+.2f}, {hi:+.2f}] | {s['holm_p']:.4f} |")
    lines += ["", "## Market-specific adjustments", "", "Only routes passing the frozen development and validation guards are applied. The table includes every task with an active route, including regressions. SP30 and all30 sometimes contain the same panels, so their gains are not independent evidence.", "", "| Channel | Task | Baseline | Global combination | With market routes | Routed lift pp | Date-bootstrap 95% pp | Paired p / Holm p |", "|---|---|---:|---:|---:|---:|---|---|"]
    for channel in PROTOCOL["channels"]:
        for task in PROTOCOL["panel_tasks"]:
            row = results["channels"][channel][task]
            if not row["routes"]:
                continue
            g, s = row["blocks"]["audit"]["global"], row["blocks"]["audit"]["routed"]
            lo, hi = s["day_bootstrap95_pp"]
            lines.append(f"| {channel} | {task} | {s['baseline_hits']}/{s['n']} | {g['candidate_hits']}/{s['n']} | {s['candidate_hits']}/{s['n']} | {s['lift_pp']:+.2f} | [{lo:+.2f}, {hi:+.2f}] | {s['paired_p']:.4f} / {s['holm_p']:.4f} |")
    lines += ["", "## Interpretation", "", "The routed known-Open Close Top-30 policy is the strongest candidate in this run. It gains 18 development hits, 6 validation hits, and 14 final-audit hits. Final accuracy rises from 45/237 to 59/237 across all Close outcomes, and from 45/186 to 59/186 conditional on SP. Its date-bootstrap interval is positive, but the paired p-value is about .065 and no selected panel comparison survives Holm adjustment. Treat it as a candidate for a new frozen extension, not a confirmed production improvement.", "", "The same policy uses a global Sutta correction of 0.25 and appearance residual weight -0.5. Kalyan Night instead uses appearance 0.25 and an avoided-digit multiplier of 1.25. Madhur Day uses Sutta -0.125, appearance -0.5, and a present-digit multiplier of 1.25. A negative appearance residual weight reverses the adjustment relative to what the base panel model already expects; it does not assert that every likely digit should be avoided.", "", "Open combinations largely fail the final block. Known-Open Close Top-10 and DP Top-10 retain small gains. Before-Open Close DP Top-30 gains in all three blocks, but only two final DP hits. Jodi-25 conditioning loses six final hits, while the 36-pair selection retains the existing grid. Derived Close absent pairs improve, but Open absent pairs regress. There is no shared multiplier that improves every output.", "", "No production change is recommended from this experiment alone. The retained candidate is fully specified in selection.json and can be scored unchanged on later, previously unused chart dates."]
    lines += ["", "## Frozen multipliers and earlier-block results", "", "Avoid multipliers apply per distinct predicted-absent digit present in a panel. Present multipliers apply per predicted-present digit contained in a panel. Sutta/appearance/conditional weights are powers of probability ratios. DP blend 1 uses the dedicated DP distribution within the original DP mass; it does not predict that a DP will occur.", ""]
    for channel in PROTOCOL["channels"]:
        lines += [f"### {channel}", "", f"Configurations evaluated on development: {selection['channels'][channel]['searched']}.", "", "| Task | Weights | Development baseline / selected | Validation baseline / selected | Routed markets |", "|---|---|---|---|---|"]
        for task, spec in selection["channels"][channel]["tasks"].items():
            b, c = spec["baseline_development"], spec["development"]
            bv, cv = spec["baseline_validation"], spec["validation"]
            lines.append(f"| {task} | `{Weights(**spec['selected']).label()}` | {100*b['rate']:.1f}% / {100*c['rate']:.1f}% | {100*bv['rate']:.1f}% / {100*cv['rate']:.1f}% | {', '.join(spec['market_routes']) or 'none'} |")
    lines += ["", "## Derived predictions from the all30 policy", "", "These use summed panel probabilities. Controls are the current Sutta rankings, current present/absent pairs, and always-SP for panel kind. They were not independently tuned on the audit block.", "", "| Channel | Output | Control | Combined | Lift pp |", "|---|---|---:|---:|---:|"]
    for channel in PROTOCOL["channels"]:
        for name, s in results["channels"][channel]["derived"].items():
            lines.append(f"| {channel} | {name} | {s['baseline_hits']}/{s['n']} | {s['candidate_hits']}/{s['n']} | {s['lift_pp']:+.2f} |")
    lines += ["", "## Jodi", "", "The control is the production 5x5 or 6x6 grid. The challenger ranks all 100 pairs using marginal rank ratings plus the smoothed historical Open-to-Close distribution. A null selected weight keeps the existing grid.", "", "| Pairs | Conditional weight | Grid | Selected | Lift pp |", "|---|---|---:|---:|---:|"]
    for count, row in results["jodi"].items():
        s = row["audit"]
        lines.append(f"| {count} | {row['conditional_weight']} | {s['baseline_hits']}/{s['n']} | {s['candidate_hits']}/{s['n']} | {s['lift_pp']:+.2f} |")
    lines += ["", "## Reproduce", "", "```powershell", "node research/combined_prediction_v1/export_replay.cjs", "python research/combined_prediction_v1/run_experiment.py select", "python research/combined_prediction_v1/run_experiment.py evaluate", "python research/combined_prediction_v1/verify_experiment.py", "```", "", "The exporter reads the tracked frozen CSV, calls current production functions with strictly prior dates, and uses checked in-memory adapters to expose full orders/raw logits. It performs no network requests. Before-Open Close probabilities use softmax(-rank/40) to preserve the public heuristic order; they are not calibrated probabilities. Raw replay is regenerable and ignored by Git.", "", f"Frozen selection SHA-256: `{results['selectionSHA256']}`.", "", "Full development search: search_development.csv. Family comparisons and market routes: selection.json. Per-market audit and paired counts: results.json. Exact selected final-block calls: audit_calls.csv.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=("select", "evaluate"))
    args = parser.parse_args()
    select() if args.stage == "select" else evaluate()
