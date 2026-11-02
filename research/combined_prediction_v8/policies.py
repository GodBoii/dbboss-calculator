"""Causal market controllers over a frozen bank of candidate hit histories.

The bank's row zero is the reference. These policies select a candidate, never
fit a new candidate. All labels on a date become visible together after that
date's decisions. Eligibility restricts historical evidence, not target routing.
"""
from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from typing import Any

import numpy as np


def catalogue() -> list[dict[str, Any]]:
    """Return 103 declared variants; variants are not independent discoveries."""
    result: list[dict[str, Any]] = [{
        "id": "baseline", "family": "baseline", "parameters": {},
        "description": "Always retain reference candidate zero.",
    }]

    def add(family: str, **parameters: Any) -> None:
        suffix = "/".join(f"{key}={value}" for key, value in parameters.items())
        result.append({"id": f"{family}/{suffix}", "family": family,
                       "parameters": parameters,
                       "description": "Earlier-date, market-specific excess-hit controller."})

    for days, support, penalty in product((14, 30, 60), (5, 10), (.05, .15, .3)):
        add("local_calendar", days=days, min_support=support, penalty=penalty)
    for draws, support, penalty in product((10, 20, 40), (5, 10), (.05, .15, .3)):
        add("local_draws", draws=draws, min_support=support, penalty=penalty)
    for prior, days, strength, penalty in product(
            ("pool", "cluster"), (30, 60), (3, 8, 16), (.1, .25)):
        add("shrinkage", prior=prior, days=days, strength=strength,
            min_support=5, penalty=penalty)
    for half_life, prior, penalty in product((7, 14, 30), ("none", "pool", "cluster"), (.1, .25)):
        add("decay", half_life=half_life, prior=prior, strength=8,
            min_support=5, penalty=penalty)
    for days, support, penalty in product((30, 60), (8, 15), (.1, .3)):
        add("empirical_bernstein", days=days, min_support=support, penalty=penalty)
    for days, recent, tolerance, prior in product(
            (30, 60), (5, 10), (0., .1), ("none", "pool")):
        add("counter_regression", days=days, recent=recent,
            tolerance=tolerance, prior=prior, strength=8,
            min_support=8, penalty=.15)
    return result


def _prefix(values: np.ndarray) -> np.ndarray:
    return np.concatenate((np.zeros((values.shape[0], 1)),
                           np.cumsum(values, axis=1)), axis=1)


def _cluster(market: str) -> str:
    # Fixed name-based grouping, independent of outcomes and observed success.
    return "night" if "night" in market.casefold() else "day"


@dataclass(frozen=True)
class Context:
    """Endpoint-specific read-only prefix evidence shared by many controllers."""

    sources: tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]
    order: np.ndarray
    day: np.ndarray
    names: np.ndarray
    market_id: np.ndarray
    evidence: np.ndarray
    values: np.ndarray
    clusters: np.ndarray
    histories: list[np.ndarray]
    totals: list[np.ndarray]
    squares: list[np.ndarray]
    starts: np.ndarray
    stops: np.ndarray


def prepare(dates: np.ndarray, markets: np.ndarray, hits: np.ndarray,
            eligible: np.ndarray) -> Context:
    """Validate and cache prefix evidence once per endpoint.

    Do not mutate source arrays during the lifetime of the returned context.
    The cache stores evidence, not policy decisions or learned parameters.
    """
    dates = np.asarray(dates)
    markets = np.asarray(markets)
    raw_hits = np.asarray(hits)
    eligible = np.asarray(eligible)
    if dates.ndim != 1 or markets.shape != dates.shape or eligible.shape != dates.shape:
        raise ValueError("dates, markets and eligible must be matching vectors")
    if eligible.dtype != np.bool_:
        raise ValueError("eligible must be boolean")
    if raw_hits.ndim != 2 or raw_hits.shape[1] != len(dates) or not raw_hits.shape[0]:
        raise ValueError("hits must have shape (nonempty candidates, events)")
    if not np.isfinite(raw_hits).all() or (raw_hits < 0).any() or (raw_hits > 1).any():
        raise ValueError("hits must contain finite scores in [0, 1]")
    day = dates.astype("datetime64[D]")
    if np.isnat(day).any():
        raise ValueError("dates must be valid calendar dates")
    order = np.argsort(day, kind="stable")
    day = day[order].astype(np.int64)
    names, market_id = np.unique(markets[order].astype(str), return_inverse=True)
    evidence = eligible[order]
    values = raw_hits[:, order].astype(np.float64)
    values -= values[0:1]
    clusters = np.array([_cluster(name) for name in names])
    histories = [np.flatnonzero((market_id == index) & evidence)
                 for index in range(len(names))]
    totals = [_prefix(values[:, index]) for index in histories]
    squares = [_prefix(values[:, index] ** 2) for index in histories]
    starts = np.r_[0, np.flatnonzero(np.diff(day)) + 1] if len(day) else np.array([], dtype=int)
    stops = np.r_[starts[1:], len(day)]
    return Context((dates, markets, raw_hits, eligible), order, day, names,
                   market_id, evidence, values, clusters, histories, totals,
                   squares, starts, stops)


def route(dates: np.ndarray, markets: np.ndarray, hits: np.ndarray,
          eligible: np.ndarray, policy: dict[str, Any],
          prepared: Context | None = None) -> np.ndarray:
    """Choose a bank row using strictly earlier dates, with optional cached data.

    Hits have shape (candidates, events). Booleans or finite composite scores
    in [0, 1] are accepted. Unsorted ISO dates are supported. Ties favor zero,
    then the lowest row index. Eligibility only restricts historical evidence.
    Prepared contexts must correspond to these same, unchanged input arrays.
    """
    family = policy.get("family")
    parameters = policy.get("parameters", {})
    known = {item["id"]: item for item in catalogue()}
    if policy.get("id") not in known or policy != known[policy["id"]]:
        raise ValueError("policy must be an unmodified catalogue entry")
    context = prepared if prepared is not None else prepare(dates, markets, hits, eligible)
    if prepared is not None and any(source is not argument for source, argument in
                                   zip(context.sources, (dates, markets, hits, eligible))):
        raise ValueError("prepared context belongs to different input arrays")
    choices = np.zeros(len(context.day), dtype=np.int32)
    if family == "baseline" or not len(context.day):
        return choices
    order, day, names = context.order, context.day, context.names
    market_id, evidence, values = context.market_id, context.evidence, context.values
    clusters, histories = context.clusters, context.histories
    totals, squares = context.totals, context.squares
    starts, stops = context.starts, context.stops
    model_count = len(values)
    log_models = np.log(max(model_count, 2))
    sorted_choices = np.zeros(len(day), dtype=np.int32)
    # Decay states: weighted first/second moments, weight and squared weight.
    decay_sum = np.zeros((len(names), model_count))
    decay_square = np.zeros_like(decay_sum)
    decay_n = np.zeros(len(names))
    decay_n2 = np.zeros(len(names))
    previous_day = day[0]

    for start, stop in zip(starts, stops):
        current_day = day[start]
        if family == "decay":
            factor = 2. ** (-(current_day - previous_day) / parameters["half_life"])
            decay_sum *= factor
            decay_square *= factor
            decay_n *= factor
            decay_n2 *= factor * factor
            sums, second, counts = decay_sum, decay_square, decay_n
            effective = counts ** 2 / np.maximum(decay_n2, 1e-15)
        else:
            sums = np.zeros_like(decay_sum)
            second = np.zeros_like(decay_sum)
            counts = np.zeros(len(names))
            for market, history in enumerate(histories):
                end = np.searchsorted(day[history], current_day)
                if "draws" in parameters:
                    begin = max(0, end - parameters["draws"])
                else:
                    begin = np.searchsorted(day[history], current_day - parameters["days"])
                sums[market] = totals[market][:, end] - totals[market][:, begin]
                second[market] = squares[market][:, end] - squares[market][:, begin]
                counts[market] = end - begin
            effective = counts

        for market in np.unique(market_id[start:stop]):
            if effective[market] < parameters["min_support"]:
                continue
            local_n = counts[market]
            local_mean = sums[market] / local_n
            local_second = second[market] / local_n
            mean = local_mean.copy()
            moment = local_second.copy()
            prior = parameters.get("prior", "none")
            if prior != "none":
                other = np.arange(len(names)) != market
                if prior == "cluster":
                    other &= clusters == clusters[market]
                pool_n = counts[other].sum()
                if pool_n:
                    # Leave target market out; finite pooled evidence shrinks
                    # toward zero before receiving bounded pseudo-count mass.
                    weight = min(parameters["strength"], pool_n)
                    pool_mean = sums[other].sum(axis=0) / (pool_n + 50.)
                    pool_second = second[other].sum(axis=0) / pool_n
                    mean = (local_n * mean + weight * pool_mean) / (local_n + weight)
                    moment = (local_n * moment + weight * pool_second) / (local_n + weight)
            variance = np.maximum(moment - mean ** 2, 0.)
            # Local effective support controls confidence even with a prior.
            # Pooling never fabricates local observations.
            n = effective[market]
            if family == "empirical_bernstein":
                uncertainty = np.sqrt(2 * variance * log_models / n) + 3 * log_models / n
            else:
                uncertainty = np.sqrt(log_models / n)
            score = mean - parameters["penalty"] * uncertainty
            if family == "counter_regression":
                history = histories[market]
                end = np.searchsorted(day[history], current_day)
                begin = max(0, end - parameters["recent"])
                if end - begin >= parameters["recent"]:
                    recent_mean = (totals[market][:, end] - totals[market][:, begin]) / (end - begin)
                    score[recent_mean < -parameters["tolerance"]] = -np.inf
            score[0] = 0.
            winner = int(np.argmax(score))
            current = np.arange(start, stop)
            sorted_choices[current[market_id[start:stop] == market]] = winner

        if family == "decay":
            # Every target on this date has already been routed.
            for market in np.unique(market_id[start:stop]):
                current = np.arange(start, stop)
                observed = current[(market_id[start:stop] == market) & evidence[start:stop]]
                decay_sum[market] += values[:, observed].sum(axis=1)
                decay_square[market] += (values[:, observed] ** 2).sum(axis=1)
                decay_n[market] += len(observed)
                decay_n2[market] += len(observed)
        previous_day = current_day

    choices[order] = sorted_choices
    return choices
