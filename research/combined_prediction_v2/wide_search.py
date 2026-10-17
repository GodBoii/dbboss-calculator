"""Wide historical search, regularized stacking, market routers and online experts.

This stage cannot read October files. Run once per channel, then freeze.py.
"""
from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict

import numpy as np
from scipy.optimize import minimize

from wide_models import (HERE, PROTOCOL, Candidate, Context, StudyReplay,
                         catalogue, centered, history_rows, save_json, score,
                         softmax, stable_ranks)

TASKS = list(PROTOCOL["tasks"])


def outcomes(replay: StudyReplay, channel: str, scores: np.ndarray) -> np.ndarray:
    if not np.isfinite(scores).all():
        raise ValueError("Non-finite candidate scores")
    return np.stack([replay.hits(channel, task, scores)[0] for task in TASKS], axis=1)


def baseline_indices(candidates: list[Candidate]) -> tuple[int, int]:
    all_index = dp_index = None
    for i, candidate in enumerate(candidates):
        if candidate.family == "loglinear":
            p = candidate.parameters
            if all(p[k] == (1 if k.endswith("multiplier") else 0) for k in p if k != "dp_blend"):
                if p["dp_blend"] == 0:
                    all_index = i
                if p["dp_blend"] == 1:
                    dp_index = i
    if all_index is None or dp_index is None:
        raise ValueError("Missing actual production controls")
    return all_index, dp_index


def fit_stack(context: Context, X: np.ndarray, train: np.ndarray, l2: float, dp_only: bool) -> tuple[np.ndarray, dict]:
    replay = context.replay
    allowed = replay.kind == "DP" if dp_only else np.ones(220, dtype=bool)
    actual = replay.actual(context.channel)
    selected = train & (replay.kind[actual] == "DP" if dp_only else True)
    indices = np.flatnonzero(allowed)
    lookup = {p: i for i, p in enumerate(indices)}
    y = np.array([lookup[p] for p in actual[selected]])
    if len(y) < 10:
        return np.zeros(X.shape[-1]), {"n": len(y), "converged": True, "no_fit": True}
    Z = X[selected][:, allowed]
    base = (replay.base(context.channel, 1)[0] if dp_only else context.base_log)[selected][:, allowed]
    Zy = Z[np.arange(len(y)), y].sum(axis=0)

    def objective(weights: np.ndarray) -> tuple[float, np.ndarray]:
        scores = base + np.einsum("epf,f->ep", Z, weights)
        shifted = scores - scores.max(axis=1, keepdims=True)
        probs = np.exp(shifted)
        denominator = probs.sum(axis=1, keepdims=True)
        probs /= denominator
        loss = -(shifted[np.arange(len(y)), y] - np.log(denominator[:, 0])).mean() + l2 * (weights @ weights)
        grad = (np.einsum("ep,epf->f", probs, Z) - Zy) / len(y) + 2 * l2 * weights
        return float(loss), grad

    result = minimize(objective, np.zeros(X.shape[-1]), jac=True, bounds=[(-2, 2)] * X.shape[-1], method="L-BFGS-B", options={"maxiter": 150, "ftol": 1e-10})
    if not result.success:
        raise RuntimeError(f"Stack optimizer failed: {result.message}")
    return result.x, {"n": len(y), "converged": bool(result.success), "iterations": int(result.nit), "objective": float(result.fun)}


def stacks(context: Context) -> tuple[list[Candidate], list[np.ndarray], list[dict]]:
    names = ["sutta", "appearance", "avoid", "present", "conditional", "frequency30", "frequency180", "weekday", "gap", "previous_overlap", "live_digits", "live_sutta", "shape_repeat"]
    X = np.stack([centered(context.features[name]) for name in names], axis=2)
    replay = context.replay
    output, histories, provenance = [], [], []
    for dp_only in (False, True):
        for l2 in PROTOCOL["stack_l2"]:
            base = replay.base(context.channel, 1)[0] if dp_only else context.base_log
            oof = base.copy()
            fits = []
            for train_end, test_end in PROTOCOL["refit_folds"]:
                train = replay.dates <= train_end
                test = (replay.dates > train_end) & (replay.dates <= test_end)
                weights, diagnostics = fit_stack(context, X, train, l2, dp_only)
                fits.append({"train_end": train_end, "test_end": test_end, **diagnostics})
                oof[test] = base[test] + np.einsum("epf,f->ep", X[test], weights)
            weights, diagnostics = fit_stack(context, X, np.ones(len(replay.rows), dtype=bool), l2, dp_only)
            if dp_only:
                dp = replay.kind == "DP"
                preserved = context.base_log.copy()
                preserved[:, dp] = np.log(softmax(oof[:, dp]) * context.q[:, dp].sum(axis=1, keepdims=True))
                oof = preserved
            p = {"features": names, "weights": weights.tolist(), "l2": l2, "dp_only": dp_only, "fit_through": PROTOCOL["development_end"]}
            output.append(Candidate("ridge_stack", p))
            histories.append(oof)
            provenance.append({"candidate": output[-1].key(), "folds": fits, "final_fit": diagnostics})
            print(f"{context.channel}: stack dp_only={dp_only} l2={l2} fitted on {diagnostics['n']} cases", flush=True)
    return output, histories, provenance


def historical_summary(replay: StudyReplay, channel: str, hit: np.ndarray, candidates: list[Candidate]) -> tuple[dict, np.ndarray]:
    actual = replay.actual(channel)
    baselines = baseline_indices(candidates)
    blocks = np.array([(replay.dates >= a) & (replay.dates <= b) for a, b in PROTOCOL["blocks"]])
    output = {"tasks": {}}
    rows = []
    for ti, task in enumerate(TASKS):
        kind = PROTOCOL["tasks"][task][0]
        eligible = np.ones(len(actual), dtype=bool) if kind == "all" else replay.kind[actual] == kind
        baseline = baselines[1 if kind == "DP" else 0]
        gain = hit[:, :, ti].astype(float) - hit[baseline, :, ti]
        pooled = gain[:, eligible].mean(axis=1)
        block_gain = np.stack([gain[:, m & eligible].mean(axis=1) for m in blocks], axis=1)
        market_gains, market_counts = [], []
        for market in sorted(set(replay.markets)):
            m = (replay.markets == market) & eligible
            market_gains.append(gain[:, m].mean(axis=1))
            market_counts.append(int(m.sum()))
        market_gain = np.stack(market_gains, axis=1)
        # Shrink thin market estimates before computing a robustness penalty.
        shrunk_market = market_gain * np.array(market_counts) / (np.array(market_counts) + 100)
        robust = pooled - .5 * block_gain.std(axis=1) + .25 * np.minimum(shrunk_market.min(axis=1), 0)
        global_index = int(np.argmax(pooled))
        stable_index = int(np.argmax(robust))
        # Prefer the unchanged control when no strictly positive score exists.
        if robust[stable_index] <= 0:
            stable_index = baseline
        families = {}
        for family in sorted({c.family for c in candidates}):
            pool = [i for i, c in enumerate(candidates) if c.family == family]
            leader = max(pool, key=lambda i: robust[i])
            families[family] = int(leader)
        routes = {}
        for strength in PROTOCOL["market_prior_strength"]:
            routing = {}
            for market in sorted(set(replay.markets)):
                m = (replay.markets == market) & eligible
                local = gain[:, m].sum(axis=1)
                global_prior = pooled
                posterior = (local + strength * global_prior) / (m.sum() + strength)
                valid = np.ones(len(candidates), dtype=bool)
                if m.sum() < (12 if kind == "DP" else 30):
                    valid[:] = False
                local_blocks = np.stack([gain[:, m & block].sum(axis=1) for block in blocks], axis=1)
                valid &= (local_blocks > 0).sum(axis=1) >= 2
                valid &= local_blocks.min(axis=1) >= -2
                valid &= local >= 3
                valid[stable_index] = True
                values = np.where(valid, posterior, -np.inf)
                routing[market] = int(np.argmax(values))
            routes[str(strength)] = routing
        lomo = {}
        for market in sorted(set(replay.markets)):
            m = (replay.markets != market) & eligible
            mean = gain[:, m].mean(axis=1)
            lomo[market] = int(np.argmax(mean)) if mean.max() > 0 else baseline
        output["tasks"][task] = {"baseline": baseline, "global_mean": global_index, "global_stable": stable_index, "market_shrink": routes, "leave_market_out": lomo, "family_leaders": families}
        for i, candidate in enumerate(candidates):
            rows.append([channel, task, i, candidate.family, int(hit[i, eligible, ti].sum()), int(eligible.sum()),
                         pooled[i], robust[i], *block_gain[i].tolist(), int((market_gain[i] > 0).sum()), float(market_gain[i].min()), float(market_gain[i].max())])
    return output, np.array(rows, dtype=object)


def warmup_pool(replay: StudyReplay, hit: np.ndarray, candidates: list[Candidate], task_index: int, baseline: int) -> list[int]:
    warmup = replay.dates <= PROTOCOL["online_warmup_end"]
    output = {baseline}
    families = sorted({c.family for c in candidates} - {"ridge_stack", "random_control"})
    gain = hit[:, warmup, task_index].astype(int) - hit[baseline, warmup, task_index]
    for family in families:
        indices = [i for i, c in enumerate(candidates) if c.family == family]
        best = max(indices, key=lambda i: gain[i].sum())
        output.add(best)
    return sorted(output)


def online_forecast(replay: StudyReplay, channel: str, task: str, hits: np.ndarray, pool: list[int], probabilities: np.ndarray,
                    baseline_index: int, window: int, prior: float, eta: float, blend: bool) -> tuple[np.ndarray, np.ndarray]:
    """Choose/mix experts using strictly earlier market-dates only."""
    ti = TASKS.index(task)
    actual = replay.actual(channel)
    kind, count = PROTOCOL["tasks"][task]
    eligible = np.ones(len(actual), dtype=bool) if kind == "all" else replay.kind[actual] == kind
    allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
    lookup = {value: i for i, value in enumerate(allowed)}
    dates = replay.dates.astype("datetime64[D]")
    base_position = pool.index(baseline_index)
    gain = hits[pool, :, ti].astype(float) - hits[baseline_index, :, ti]
    chosen, result = np.full(len(actual), baseline_index, dtype=int), np.zeros(len(actual), dtype=bool)
    for date_value in np.unique(dates):
        current = dates == date_value
        past = (dates < date_value) & (dates >= date_value - np.timedelta64(window, "D")) & eligible
        prior_mean = gain[:, past].mean(axis=1) if past.any() else np.zeros(len(pool))
        for market in np.unique(replay.markets[current]):
            indices = np.flatnonzero(current & (replay.markets == market))
            local = past & (replay.markets == market)
            mean = (gain[:, local].sum(axis=1) + prior * prior_mean) / (local.sum() + prior)
            if str(date_value) <= PROTOCOL["online_warmup_end"] or past.sum() < 20:
                mean = np.zeros(len(pool))
                mean[base_position] = 1
            best = int(np.argmax(mean))
            chosen[indices] = pool[best]
            if not blend:
                result[indices] = hits[pool[best], indices, ti]
            else:
                weight = softmax((eta * mean)[None, :])[0]
                # The unchanged control keeps half the mixture mass.
                weight *= .5
                weight[base_position] += .5
                for i in indices:
                    mixed = np.einsum("k,kp->p", weight, probabilities[:, i])
                    picks = allowed[np.argsort(-mixed, kind="stable")[:count]]
                    result[i] = actual[i] in picks
    return result, chosen


def select_online(context: Context, hit: np.ndarray, candidates: list[Candidate], static: dict,
                  oof: dict[int, np.ndarray]) -> dict:
    replay, channel = context.replay, context.channel
    output = {}
    evaluation = replay.dates > PROTOCOL["online_warmup_end"]
    for ti, task in enumerate(TASKS):
        baseline = static["tasks"][task]["baseline"]
        pool = warmup_pool(replay, hit, candidates, ti, baseline)
        kind = PROTOCOL["tasks"][task][0]
        allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
        probabilities = np.stack([softmax(-stable_ranks((oof[i] if i in oof else score(context, candidates[i]))[:, allowed]) / 40) for i in pool])
        eligible = np.ones(len(replay.rows), dtype=bool) if kind == "all" else replay.kind[replay.actual(channel)] == kind
        control = hit[baseline, :, ti]
        choices = []
        for window, prior, blend in itertools_product():
            for eta in (PROTOCOL["online_eta"] if blend else [0]):
                values, _ = online_forecast(replay, channel, task, hit, pool, probabilities, baseline, window, prior, eta, blend)
                delta = values.astype(float) - control
                blocks = [delta[(replay.dates >= a) & (replay.dates <= b) & eligible & evaluation].mean() for a, b in PROTOCOL["blocks"] if ((replay.dates >= a) & (replay.dates <= b) & eligible & evaluation).any()]
                utility = float(delta[eligible & evaluation].mean() - .5 * np.std(blocks))
                choices.append({"window": window, "prior": prior, "eta": eta, "blend": blend, "historical_lift": float(delta[eligible & evaluation].mean()), "historical_stability_score": utility})
        best = max(choices, key=lambda c: c["historical_stability_score"])
        output[task] = {"pool": pool, "selected": best, "guard_enabled": best["historical_stability_score"] > 0, "tried": choices}
        print(f"{channel}: online {task}, {len(choices)} controllers, {len(pool)} warmup-selected experts", flush=True)
    return output


def itertools_product():
    import itertools
    return itertools.product(PROTOCOL["online_windows"], PROTOCOL["online_local_prior"], [False, True])


def build(channel: str) -> None:
    replay = StudyReplay()
    context = Context(replay, channel, history_rows())
    candidates = catalogue(channel)
    learned, learned_history, provenance = stacks(context)
    offset = len(candidates)
    candidates += learned
    oof = {offset + i: values for i, values in enumerate(learned_history)}
    all_hits = []
    for i, candidate in enumerate(candidates):
        values = oof[i] if i in oof else score(context, candidate)
        all_hits.append(outcomes(replay, channel, values))
        if (i + 1) % 250 == 0:
            print(f"{channel}: evaluated {i+1}/{len(candidates)} candidates", flush=True)
    hit = np.stack(all_hits)
    static, rows = historical_summary(replay, channel, hit, candidates)
    online = select_online(context, hit, candidates, static, oof)
    save_json(HERE / f"catalogue_{channel}.json", [asdict(c) for c in candidates])
    save_json(HERE / f"selection_{channel}.json", {"static": static, "online": online, "stack_provenance": provenance})
    np.savez_compressed(HERE / f"history_{channel}.npz", hits=hit, dates=replay.dates, markets=replay.markets)
    np.savez_compressed(HERE / f"oof_{channel}.npz", **{str(i): values for i, values in oof.items()})
    with (HERE / f"search_{channel}.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["channel", "task", "candidate", "family", "hits", "n", "pooled_lift", "stability_score", "block1_lift", "block2_lift", "block3_lift", "markets_positive", "worst_market_lift", "best_market_lift"])
        writer.writerows(rows)
    print(f"{channel}: saved {len(candidates)} candidates and all historical results", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("channel", choices=PROTOCOL["channels"])
    build(parser.parse_args().channel)
