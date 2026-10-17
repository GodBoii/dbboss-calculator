"""Score frozen policies on October, including failures and matched controls."""
from __future__ import annotations

import copy
import csv
import itertools
import json
from functools import lru_cache

import numpy as np
from scipy.stats import binomtest

from wide_models import HERE, PROTOCOL, Candidate, Context, StudyReplay, Weights, history_rows, save_json, score, sha, softmax, stable_ranks
from wide_search import TASKS, online_forecast, outcomes
from secondary_search import make_experts, predict, hits as secondary_hits, native_hits


@lru_cache(maxsize=40)
def signs(count: int) -> np.ndarray:
    if count > 18:
        raise ValueError("Exact day-cluster test budget exceeded; predeclare a new procedure")
    codes = np.arange(2 ** count, dtype=np.uint32)
    return ((codes[:, None] >> np.arange(count)) & 1).astype(np.int8) * 2 - 1


def comparison(dates: np.ndarray, baseline: np.ndarray, candidate: np.ndarray,
               eligible: np.ndarray | None = None, calls: np.ndarray | None = None) -> dict:
    if eligible is None:
        eligible = np.ones(len(dates), dtype=bool)
    if calls is None:
        calls = np.ones(len(dates), dtype=bool)
    use = eligible & calls
    n = int(use.sum())
    if not n:
        return {"n": 0, "baseline_hits": 0, "candidate_hits": 0, "baseline_rate": None, "candidate_rate": None,
                "lift_pp": None, "day_bootstrap95_pp": [None, None], "paired_p": 1., "day_cluster_p": 1.,
                "coverage": float(calls.mean()), "candidate_only": 0, "baseline_only": 0, "unconditional_candidate_rate": None}
    b, c = baseline[use], candidate[use]
    delta = c.astype(int) - b.astype(int)
    unique = np.unique(dates[use])
    day_n = np.array([(dates[use] == d).sum() for d in unique])
    day_delta = np.array([delta[dates[use] == d].sum() for d in unique])
    permutations = signs(len(unique)) @ day_delta
    cluster_p = float((np.abs(permutations) >= abs(day_delta.sum())).mean())
    rng = np.random.default_rng(PROTOCOL["seed"])
    indices = rng.integers(0, len(unique), (PROTOCOL["bootstrap_samples"], len(unique)))
    samples = day_delta[indices].sum(axis=1) / day_n[indices].sum(axis=1)
    wins, losses = int(((~b) & c).sum()), int((b & (~c)).sum())
    return {"n": n, "baseline_hits": int(b.sum()), "candidate_hits": int(c.sum()),
            "baseline_rate": float(b.mean()), "candidate_rate": float(c.mean()), "lift_pp": float(100 * delta.mean()),
            "day_bootstrap95_pp": (100 * np.quantile(samples, [.025, .975])).tolist(),
            "paired_p": float(binomtest(wins, wins + losses).pvalue) if wins + losses else 1.,
            "day_cluster_p": cluster_p, "candidate_only": wins, "baseline_only": losses,
            "coverage": float(calls.mean()), "unconditional_candidate_rate": float(candidate[calls].mean())}


def combined_replay(old: StudyReplay, new: StudyReplay) -> StudyReplay:
    result = copy.copy(old)
    result.rows = old.rows + new.rows
    for attr in ("dates", "markets", "actual_open", "actual_close", "conditional"):
        setattr(result, attr, np.concatenate([getattr(old, attr), getattr(new, attr)]))
    result.channels = {c: {k: np.concatenate([old.channels[c][k], new.channels[c][k]]) for k in old.channels[c]} for c in PROTOCOL["channels"]}
    result._base_cache = {}
    return result


def online_exact_scores(replay: StudyReplay, channel: str, task: str, hit: np.ndarray, pool: list[int], probabilities: np.ndarray, baseline: int, settings: dict, candidate_scores: dict[int, np.ndarray]) -> np.ndarray:
    """Reconstruct exact lists from the frozen controller, then check its API."""
    kind, count = PROTOCOL["tasks"][task]
    actual = replay.actual(channel)
    allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
    eligible = np.ones(len(actual), dtype=bool) if kind == "all" else replay.kind[actual] == kind
    dates = replay.dates.astype("datetime64[D]")
    base_position = pool.index(baseline)
    gain = hit[pool, :, TASKS.index(task)].astype(float) - hit[baseline, :, TASKS.index(task)]
    result = np.full((len(actual), 220), -1e6)
    for day in np.unique(dates):
        current = dates == day
        past = (dates < day) & (dates >= day - np.timedelta64(settings["window"], "D")) & eligible
        global_mean = gain[:, past].mean(axis=1) if past.any() else np.zeros(len(pool))
        for market in np.unique(replay.markets[current]):
            indices = np.flatnonzero(current & (replay.markets == market))
            local = past & (replay.markets == market)
            mean = (gain[:, local].sum(axis=1) + settings["prior"] * global_mean) / (local.sum() + settings["prior"])
            if str(day) <= PROTOCOL["online_warmup_end"] or past.sum() < 20:
                mean = np.zeros(len(pool)); mean[base_position] = 1
            best = int(mean.argmax())
            if not settings["blend"]:
                result[indices] = candidate_scores[pool[best]][indices]
            else:
                weights = softmax((settings["eta"] * mean)[None, :])[0] * .5
                weights[base_position] += .5
                for i in indices:
                    result[i, allowed] = np.einsum("k,kp->p", weights, probabilities[:, i])
    api, _ = online_forecast(replay, channel, task, hit, pool, probabilities, baseline,
                             settings["window"], settings["prior"], settings["eta"], settings["blend"])
    np.testing.assert_array_equal(api, replay.hits(channel, task, result)[0])
    return result


def verify_frozen() -> dict:
    manifest = json.loads((HERE / "freeze_manifest.json").read_text())
    for filename, expected in manifest["files"].items():
        if sha(HERE / filename) != expected:
            raise ValueError(f"Frozen artifact changed: {filename}")
    return json.loads((HERE / "frozen_policy.json").read_text())


def secondary_lists(replay: StudyReplay, channel: str, task: str, values: np.ndarray | None, native: np.ndarray) -> list[list[str]]:
    if values is None and task.startswith("jodi"):
        width = int(np.sqrt(int(task.removeprefix("jodi"))))
        return [[f"{o}{c}" for o in row["productionSuttas"]["open"][:width] for c in row["productionSuttas"]["close"][:width]] for row in replay.rows]
    if values is None:
        values = native
    if task.startswith("sutta"):
        count = int(task.removeprefix("sutta"))
        return [[str(v) for v in row] for row in np.argsort(-values, axis=1, kind="stable")[:, :count]]
    if task.startswith("jodi"):
        count = int(task.removeprefix("jodi"))
        return [[f"{v:02d}" for v in row] for row in np.argsort(-values, axis=1, kind="stable")[:, :count]]
    if task in ("present2", "absent2"):
        pairs = list(itertools.combinations(range(10), 2))
        return [[str(v) for v in pairs[i]] for i in values.argmax(axis=1)]
    return [[("SP", "DP", "TP")[i]] for i in values.argmax(axis=1)]


def run() -> None:
    frozen = verify_frozen()
    old, new = StudyReplay(), StudyReplay(extension=True)
    joined = combined_replay(old, new)
    old_count = len(old.rows)
    records = history_rows(extension=True)
    v1 = json.loads((HERE.parent / "combined_prediction_v1/selection.json").read_text())
    if sha(HERE.parent / "combined_prediction_v1/selection.json") != frozen["v1_selectionSHA256"]:
        raise ValueError("V1 policy changed")
    result = {"study": PROTOCOL["study"], "policySHA256": sha(HERE / "frozen_policy.json"), "extension_rows": len(new.rows), "channels": {}, "secondary": {}, "confidence_gates": [], "family_leaders": [], "daily": {}, "hypotheses": 0}
    call_rows, secondary_rows, market_rows, family_rows, diagnostic_rows = [], [], [], [], []
    adjustment = []
    saved_hit = {}
    for channel in PROTOCOL["channels"]:
        context = Context(new, channel, records)
        old_context = Context(old, channel, history_rows())
        catalogue = [Candidate(**c) for c in json.loads((HERE / f"catalogue_{channel}.json").read_text())]
        selection = frozen["channels"][channel]
        old_hit = np.load(HERE / f"history_{channel}.npz")["hits"]
        oof = np.load(HERE / f"oof_{channel}.npz")
        needed = set()
        for task, spec in selection["static"]["tasks"].items():
            needed.update([spec["baseline"], spec["global_mean"], spec["global_stable"]])
            needed.update(spec["family_leaders"].values())
            needed.update(spec["leave_market_out"].values())
            for route in spec["market_shrink"].values():
                needed.update(route.values())
            needed.update(selection["online"][task]["pool"])
        cache = {i: score(context, catalogue[i]) for i in sorted(needed)}
        new_hit = np.zeros((len(catalogue), len(new.rows), len(TASKS)), dtype=bool)
        for i, scores in cache.items():
            new_hit[i] = outcomes(new, channel, scores)
        combined_hit = np.concatenate([old_hit, new_hit], axis=1)
        result["channels"][channel] = {}
        saved_hit[channel] = {}
        for ti, task in enumerate(TASKS):
            spec = selection["static"]["tasks"][task]
            baseline = new_hit[spec["baseline"], :, ti]
            kind, count = PROTOCOL["tasks"][task]
            eligible = np.ones(len(new.rows), dtype=bool) if kind == "all" else new.kind[new.actual(channel)] == kind
            policies = {"global_mean": cache[spec["global_mean"]], "global_stable": cache[spec["global_stable"]]}
            for strength, mapping in spec["market_shrink"].items():
                routed = cache[spec["global_stable"]].copy()
                for market, i in mapping.items():
                    mask = new.markets == market
                    routed[mask] = cache[i][mask]
                policies[f"market_shrink_{strength}"] = routed
            lomo = cache[spec["global_stable"]].copy()
            for market, i in spec["leave_market_out"].items():
                mask = new.markets == market
                lomo[mask] = cache[i][mask]
            policies["leave_market_out"] = lomo
            online = selection["online"][task]
            pool = online["pool"]
            allowed = np.arange(220) if kind == "all" else np.flatnonzero(new.kind == kind)
            score_history = {i: np.concatenate([oof[str(i)] if str(i) in oof.files else score(old_context, catalogue[i]), cache[i]]) for i in pool}
            probabilities = np.stack([softmax(-stable_ranks(score_history[i][:, allowed]) / 40) for i in pool])
            online_scores = online_exact_scores(joined, channel, task, combined_hit, pool, probabilities, spec["baseline"], online["selected"], score_history)[old_count:]
            policies["online_raw"] = online_scores
            policies["online_guarded"] = online_scores if online["guard_enabled"] else cache[spec["baseline"]]
            v1_spec = v1["channels"][channel]["tasks"][task]
            v1_global = new.scores(channel, Weights(**v1_spec["selected"]))
            v1_routed = v1_global.copy()
            for market, route in v1_spec["market_routes"].items():
                mask = new.markets == market
                v1_routed[mask] = new.scores(channel, Weights(**route["weights"]))[mask]
            policies["v1_global"], policies["v1_routed"] = v1_global, v1_routed
            result["channels"][channel][task] = {}
            for name, scores in policies.items():
                hit, _ = new.hits(channel, task, scores)
                metrics = comparison(new.dates, baseline, hit, eligible)
                # October 1-2 also appear in older repository audits. Excluding
                # those dates is a post-hoc sensitivity check, not reselection.
                later = new.dates >= "2026-10-03"
                metrics["october3_onward_sensitivity"] = comparison(new.dates[later], baseline[later], hit[later], eligible[later])
                result["channels"][channel][task][name] = metrics
                adjustment.append(metrics)
                saved_hit[channel][task + "/" + name] = hit
                for market in sorted(set(new.markets)):
                    use = (new.markets == market) & eligible
                    n = int(use.sum())
                    market_rows.append(["extension", channel, task, name, market, n, int(baseline[use].sum()), int(hit[use].sum()), int(hit[use].sum()-baseline[use].sum())])
                order = allowed[np.argsort(-scores[:, allowed], axis=1, kind="stable")[:, :count]]
                for row, picks in enumerate(order):
                    call_rows.append([new.dates[row], new.markets[row], channel, task, name, new.panels[new.actual(channel)[row]], int(eligible[row]), int(baseline[row]), int(hit[row]), " ".join(new.panels[p] for p in picks)])
            # Family leaders were selected from July-September only. All are
            # scored, including random controls and negative directions.
            for family, i in spec["family_leaders"].items():
                hit = new_hit[i, :, ti]
                metrics = comparison(new.dates, baseline, hit, eligible)
                item = {"channel": channel, "task": task, "family": family, "candidate": i, "definition": {"family": catalogue[i].family, "parameters": catalogue[i].parameters}, "metrics": metrics}
                result["family_leaders"].append(item)
                family_rows.append([channel, task, family, i, metrics["n"], metrics["baseline_hits"], metrics["candidate_hits"], metrics["lift_pp"], metrics["day_cluster_p"]])
                for market in sorted(set(new.markets)):
                    use = (new.markets == market) & eligible
                    market_rows.append(["extension_family", channel, task, family, market, int(use.sum()), int(baseline[use].sum()), int(hit[use].sum()), int(hit[use].sum()-baseline[use].sum())])
            # Selective forecasts compare with the control on exactly the same
            # called observations. Abstention is never scored as a correct hit.
            stable_scores = policies["global_stable"]
            q = softmax(stable_scores[:, allowed])
            ordered_q = np.sort(q, axis=1)[:, ::-1]
            features = {"topk_mass": ordered_q[:, :count].sum(axis=1), "boundary_margin": ordered_q[:, count-1] - ordered_q[:, count], "model_agreement": context.states["agreement"]}
            stable_hit = new.hits(channel, task, stable_scores)[0]
            for gate in frozen["confidence_gates"][channel][task]:
                calls = features[gate["feature"]] >= gate["threshold"]
                result["confidence_gates"].append({"channel": channel, "task": task, **gate, "metrics": comparison(new.dates, baseline, stable_hit, eligible, calls)})
            # A true hard intersection is an eligibility diagnostic. It cannot
            # silently fill an undersized list with forbidden panels.
            avoid_ok = context.features["avoid"] == 0
            sutta_ok = stable_ranks(new.channels[channel]["sutta"])[:, new.sutta] < 6
            actual = new.actual(channel)
            for constraint, permitted in (("avoid_pair", avoid_ok), ("sutta6_and_avoid", avoid_ok & sutta_ok)):
                actual_pass = permitted[np.arange(len(actual)), actual]
                permitted_count = permitted[:, allowed].sum(axis=1)
                diagnostic_rows.append([channel, task, constraint, int(eligible.sum()), int(actual_pass[eligible].sum()), float(permitted_count.mean()), int((permitted_count < count).sum())])
        np.savez_compressed(HERE / f"extension_hits_{channel}.npz", **saved_hit[channel])
        print(f"Extension scored {channel}: {len(needed)} frozen candidate recipes and all selected policies", flush=True)
    # Secondary outputs are selected independently of the panel endpoints.
    for channel in PROTOCOL["channels"]:
        context = Context(new, channel, records)
        experts = make_experts(context, records)
        result["secondary"][channel] = {}
        for task, spec in frozen["secondary"][channel].items():
            domain = spec["domain"]
            baseline = native_hits(new, channel, task, experts[domain])
            variants = {}
            prediction_lists = {}
            for name, index in (("mean", spec["mean"]), ("stable", spec["stable"])):
                values = None if index is None else predict(experts[domain], spec["catalogue"][index])
                if index is None:
                    hit = baseline.copy()
                else:
                    hit = secondary_hits(new, channel, task, values)
                variants[name] = hit
                prediction_lists[name] = secondary_lists(new, channel, task, values, experts[domain]["native"])
            routed = variants["stable"].copy()
            routed_lists = [list(p) for p in prediction_lists["stable"]]
            for market, index in spec["market_routes"].items():
                mask = new.markets == market
                values = predict(experts[domain], spec["catalogue"][index])
                hit = secondary_hits(new, channel, task, values)
                lists = secondary_lists(new, channel, task, values, experts[domain]["native"])
                routed[mask] = hit[mask]
                for i in np.flatnonzero(mask):
                    routed_lists[i] = lists[i]
            variants["market_routes"] = routed
            prediction_lists["market_routes"] = routed_lists
            result["secondary"][channel][task] = {}
            for name, hit in variants.items():
                metrics = comparison(new.dates, baseline, hit)
                later = new.dates >= "2026-10-03"
                metrics["october3_onward_sensitivity"] = comparison(new.dates[later], baseline[later], hit[later])
                result["secondary"][channel][task][name] = metrics
                adjustment.append(metrics)
                for market in sorted(set(new.markets)):
                    use = new.markets == market
                    market_rows.append(["extension_secondary", channel, task, name, market, int(use.sum()), int(baseline[use].sum()), int(hit[use].sum()), int(hit[use].sum()-baseline[use].sum())])
                for i, picks in enumerate(prediction_lists[name]):
                    panel = new.panels[new.actual(channel)[i]]
                    actual = str(new.sutta[new.actual(channel)[i]]) if task.startswith("sutta") else (new.kind[new.actual(channel)[i]] if task == "kind" else (f"{new.sutta[new.actual_open[i]]}{new.sutta[new.actual_close[i]]}" if task.startswith("jodi") else panel))
                    secondary_rows.append([new.dates[i], new.markets[i], channel, task, name, actual, int(baseline[i]), int(hit[i]), " ".join(picks)])
    # One family covers all selected panel policies and secondary policies.
    ordered = sorted(adjustment, key=lambda m: m["day_cluster_p"])
    previous = 0.
    for rank, metrics in enumerate(ordered):
        previous = max(previous, min(1., metrics["day_cluster_p"] * (len(ordered) - rank)))
        metrics["holm_day_p"] = previous
    result["hypotheses"] = len(ordered)
    for task in ("all10", "all30", "sp30", "dp20"):
        result["daily"][task] = {}
        for policy in ("global_stable", "market_shrink_100", "online_guarded", "v1_routed"):
            values = []
            for day in sorted(set(new.dates)):
                use = new.dates == day
                hit = int(saved_hit["open"][task + "/" + policy][use].sum() + saved_hit["close_known"][task + "/" + policy][use].sum())
                values.append({"date": day, "available_open_close": 2 * int(use.sum()), "hits": hit})
            result["daily"][task][policy] = values
    save_json(HERE / "extension_results.json", result)
    for filename, header, rows in [
        ("extension_calls.csv", ["date", "market", "channel", "task", "policy", "actual", "actual_kind_eligible", "baseline_hit", "hit", "panels"], call_rows),
        ("secondary_calls.csv", ["date", "market", "channel", "task", "policy", "actual", "baseline_hit", "hit", "predictions"], secondary_rows),
        ("market_matrix.csv", ["block", "channel", "task", "policy", "market", "n", "baseline_hits", "candidate_hits", "net_hits"], market_rows),
        ("family_extension.csv", ["channel", "task", "family", "candidate", "n", "baseline_hits", "candidate_hits", "lift_pp", "day_cluster_p"], family_rows),
        ("hard_constraint_diagnostics.csv", ["channel", "task", "constraint", "eligible_n", "actual_survives", "mean_eligible_panels", "undersized_lists"], diagnostic_rows),
    ]:
        with (HERE / filename).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle); writer.writerow(header); writer.writerows(rows)
    verify_frozen()
    print(f"Saved {len(call_rows)} exact extension lists and {len(ordered)} selected comparisons. No reselection occurred.", flush=True)


if __name__ == "__main__":
    run()
