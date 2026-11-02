"""Independent V8 budget, endpoint, selection and chronological-controller audit."""
from __future__ import annotations

import hashlib
import csv
import gzip
import itertools
import json
from pathlib import Path
from typing import Any

import numpy as np

HERE = Path(__file__).resolve().parent
METRICS = ("top5", "avoid2", "panel10", "sp30", "dp20")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read(name: str) -> Any:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def independent_picks(replay: Any, probabilities: np.ndarray) -> dict[str, np.ndarray]:
    panels = list(replay.panels)
    require(probabilities.shape == (len(replay.rows), 220), "Invalid panel probability shape")
    require(bool(np.isfinite(probabilities).all() and (probabilities > 0).all()), "Invalid probabilities")
    np.testing.assert_allclose(probabilities.sum(axis=1), 1, atol=1e-10, rtol=0)
    sutta = np.array([sum(map(int, panel)) % 10 for panel in panels])
    kinds = np.array(["SP" if len(set(panel)) == 3 else "DP" if len(set(panel)) == 2 else "TP" for panel in panels])
    require(int((kinds == "SP").sum()) == 120 and int((kinds == "DP").sum()) == 90, "Panel universe differs")
    pairs = np.array(list(itertools.combinations(range(10), 2)))
    marginal = np.stack([probabilities[:, sutta == digit].sum(axis=1) for digit in range(10)], axis=1)
    absent = np.stack([probabilities[:, [str(a) not in p and str(b) not in p for p in panels]].sum(axis=1)
                       for a, b in pairs], axis=1)
    picks = {"top5": np.argsort(-np.round(marginal, 12), axis=1, kind="stable")[:, :5],
             "avoid2": pairs[np.argmax(np.round(absent, 12), axis=1)]}
    for metric, kind, budget in (("panel10", None, 10), ("sp30", "SP", 30), ("dp20", "DP", 20)):
        universe = np.arange(220) if kind is None else np.flatnonzero(kinds == kind)
        picks[metric] = universe[np.argsort(-np.round(probabilities[:, universe], 12), axis=1, kind="stable")[:, :budget]]
    for metric, budget in (("top5", 5), ("avoid2", 2), ("panel10", 10), ("sp30", 30), ("dp20", 20)):
        require(picks[metric].shape == (len(replay.rows), budget), f"Wrong {metric} budget")
        require(bool((np.diff(np.sort(picks[metric], axis=1), axis=1) > 0).all()), f"Duplicate {metric} picks")
    return picks


def independent_hits(replay: Any, channel: str, picks: dict[str, np.ndarray]) -> tuple[dict, dict]:
    actual = replay.actual(channel)
    panel_text = np.asarray(replay.panels)[actual]
    sutta = np.array([sum(map(int, panel)) % 10 for panel in panel_text])
    kinds = np.array(["SP" if len(set(p)) == 3 else "DP" if len(set(p)) == 2 else "TP" for p in panel_text])
    eligible = {metric: np.ones(len(actual), dtype=bool) for metric in METRICS}
    eligible["sp30"], eligible["dp20"] = kinds == "SP", kinds == "DP"
    hit = {"top5": (picks["top5"] == sutta[:, None]).any(axis=1),
           "avoid2": np.array([all(str(digit) not in panel for digit in pair)
                               for panel, pair in zip(panel_text, picks["avoid2"], strict=True)])}
    for metric in ("panel10", "sp30", "dp20"):
        hit[metric] = (picks[metric] == actual[:, None]).any(axis=1)
    return hit, eligible


def verify_jodi_budget(open_digits: np.ndarray, close_digits: np.ndarray) -> None:
    require(open_digits.shape == close_digits.shape and open_digits.shape[1] == 5, "Invalid Jodi sides")
    pairs = (10 * open_digits[:, :, None] + close_digits[:, None, :]).reshape(-1, 25)
    require(bool(((pairs >= 0) & (pairs <= 99)).all()), "Invalid Jodi pair")
    require(bool((np.diff(np.sort(pairs, axis=1), axis=1) > 0).all()), "Jodi25 is not 25 distinct ordered pairs")


def controller_checks(dates: np.ndarray, markets: np.ndarray, hits: np.ndarray,
                      eligible: np.ndarray, catalogue: list[dict], router: Any) -> dict[str, int]:
    """Audit real controller inputs without letting same-day labels affect routes."""
    unique = np.unique(dates)
    require(len(unique) >= 4, "Too few dates for chronological controller audit")
    cutoff = unique[len(unique) * 2 // 3]
    before = dates <= cutoff
    future = dates >= cutoff
    altered = hits.copy()
    altered[:, future] = 1 - altered[:, future]
    altered_eligibility = eligible.copy()
    altered_eligibility[future] = ~altered_eligibility[future]
    permutation = np.random.default_rng(20261102).permutation(len(dates))
    inverse = np.argsort(permutation)
    checks = {"policies": 0, "label_perturbations": 0, "eligibility_perturbations": 0,
              "prefix_checks": 0, "permutation_checks": 0}
    for policy in catalogue:
        chosen = router(dates, markets, hits, eligible, policy)
        require(chosen.shape == dates.shape and np.issubdtype(chosen.dtype, np.integer), "Invalid controller route shape/type")
        require(bool(((chosen >= 0) & (chosen < len(hits))).all()), "Controller returned invalid source index")
        perturbed = router(dates, markets, altered, eligible, policy)
        np.testing.assert_array_equal(chosen[before], perturbed[before], err_msg=f"Future/same-day labels changed {policy['id']}")
        different_eligibility = router(dates, markets, hits, altered_eligibility, policy)
        np.testing.assert_array_equal(chosen[before], different_eligibility[before], err_msg=f"Future/same-day eligibility changed {policy['id']}")
        prefix = router(dates[before], markets[before], hits[:, before], eligible[before], policy)
        np.testing.assert_array_equal(chosen[before], prefix, err_msg=f"Prefix instability: {policy['id']}")
        permuted = router(dates[permutation], markets[permutation], hits[:, permutation], eligible[permutation], policy)
        np.testing.assert_array_equal(chosen, permuted[inverse], err_msg=f"Row-order instability: {policy['id']}")
        for key in checks:
            checks[key] += 1
    return checks


def synthetic_controller_checks(router: Any, catalogue: list[dict]) -> dict[str, int]:
    """Exercise every declared controller on repeated dates and sparse evidence."""
    dates = np.repeat(np.arange("2026-06-01", "2026-09-01", dtype="datetime64[D]").astype(str), 4)
    markets = np.tile(np.array(["alpha", "beta night", "gamma", "delta night"]), len(dates) // 4)
    generator = np.random.default_rng(861102)
    hits = generator.random((7, len(dates))) < np.array([.45, .65, .4, .5, .55, .35, .6])[:, None]
    eligible = generator.random(len(dates)) > .25
    return controller_checks(dates, markets, hits, eligible, catalogue, router)


def independent_static(metadata: dict, bank: Any, prior_counts: np.ndarray | None = None) -> np.ndarray:
    """Rebuild declared mixtures from their parameters and frozen source arrays."""
    parameters = metadata["parameters"]
    family = metadata["family"]
    if family == "static_native":
        return bank.native[parameters["source"]]
    if family == "static_component_control":
        return getattr(bank, parameters["scope"])[parameters["component"]]
    require(family in {"static_arithmetic", "static_geometric"}, f"Unknown static family: {family}")
    if "prior" in parameters:
        n = prior_counts if prior_counts is not None else np.array([
            int(((bank.markets == market) & (bank.dates < day)).sum())
            for day, market in zip(bank.dates, bank.markets, strict=True)])[:, None]
        np.testing.assert_array_equal(bank.local_prior_samples, n)
        alpha = n / (n + parameters["prior"])
    else:
        alpha = parameters["local_fraction"]
    mixtures = []
    for metric in METRICS:
        p = np.maximum((1 - alpha) * bank.pooled[metric] + alpha * bank.local[metric], 1e-15)
        mixtures.append(p / p.sum(axis=1, keepdims=True))
    weights = parameters["component_weights"]
    require(set(weights) == set(METRICS), "Static mixture omitted a component")
    require(all(weights[metric] > 0 for metric in METRICS), "Static mixture has a nonpositive component")
    require(abs(sum(weights.values()) - 1) < 1e-12, "Static component weights do not sum to one")
    if family == "static_arithmetic":
        values = sum(weights[metric] * p for metric, p in zip(METRICS, mixtures, strict=True))
    else:
        logs = sum(weights[metric] * np.log(p) for metric, p in zip(METRICS, mixtures, strict=True))
        values = np.exp(logs - logs.max(axis=1, keepdims=True))
    values = np.maximum(values, 1e-15)
    return values / values.sum(axis=1, keepdims=True)


def independent_choice(hits: np.ndarray, eligible: np.ndarray, scope: np.ndarray,
                       dates: np.ndarray) -> int:
    train = scope & eligible & (dates >= "2026-09-08") & (dates <= "2026-09-30")
    validation = scope & eligible & (dates >= "2026-10-01") & (dates <= "2026-10-15")
    if train.sum() < 15 or validation.sum() < 8:
        return 0
    valid = [0]
    for index in range(1, len(hits)):
        if hits[index, train].sum() >= hits[0, train].sum() and hits[index, validation].sum() > hits[0, validation].sum():
            valid.append(index)
    return min(valid, key=lambda index: (-int(hits[index, validation].sum()), index != 0,
                                        -int(hits[index, train].sum()), index))


def verify_counts(value: dict, base: np.ndarray, current: np.ndarray, use: np.ndarray) -> None:
    expected = {"n": int(use.sum()), "baseline_hits": int(base[use].sum()),
                "candidate_hits": int(current[use].sum()),
                "wins": int((current & ~base & use).sum()),
                "losses": int((base & ~current & use).sum())}
    for name, count in expected.items():
        require(value[name] == count, f"Reported {name} differs: {value[name]} vs {count}")
    require(expected["candidate_hits"] - expected["baseline_hits"] == expected["wins"] - expected["losses"], "Paired counts inconsistent")
    if "lift_pp" in value:
        expected_lift = 100 * (expected["wins"] - expected["losses"]) / expected["n"] if expected["n"] else None
        require(value["lift_pp"] == expected_lift, "Reported paired lift differs")


def audit_manifests(manifest: dict) -> int:
    """Verify declared local artifact hashes without changing upstream evidence."""
    checked = 0
    for filename, expected in manifest["files"].items():
        candidate = Path(filename)
        if not candidate.is_absolute():
            candidate = HERE / candidate
            if not candidate.exists():
                candidate = HERE.parent / filename
        require(candidate.is_file(), f"Missing declared lineage artifact: {filename}")
        require(digest(candidate) == expected, f"Declared lineage hash differs: {filename}")
        checked += 1
    require(checked > 0, "Empty artifact lineage manifest")
    return checked


def independent_policy_choice(hits: np.ndarray, eligible: np.ndarray, scope: np.ndarray,
                              dates: np.ndarray) -> tuple[int, str]:
    train = scope & eligible & (dates >= "2026-09-08") & (dates <= "2026-09-30")
    validation = scope & eligible & (dates >= "2026-10-01") & (dates <= "2026-10-15")
    if train.sum() >= 15 and validation.sum() >= 8:
        return independent_choice(hits, eligible, scope, dates), "local"
    other_train = ~scope & eligible & (dates >= "2026-09-08") & (dates <= "2026-09-30")
    other_validation = ~scope & eligible & (dates >= "2026-10-01") & (dates <= "2026-10-15")
    if other_train.sum() < 30 or other_validation.sum() < 15:
        return 0, "insufficient_support"
    delta = hits.astype(np.int16) - hits[0].astype(np.int16)
    allowed = [0] + [index for index in range(1, len(hits))
                     if delta[index, train].sum() >= 0 and delta[index, validation].sum() >= 0
                     and delta[index, other_train].sum() >= 0 and delta[index, other_validation].sum() >= 2]
    selected = min(allowed, key=lambda index: (-(float(delta[index, validation].sum())
                    + 10 * float(delta[index, other_validation].mean())), index != 0,
                    -int(delta[index, train].sum()), index))
    return selected, "sparse_transfer"


def verify_source_usage() -> dict[str, int]:
    """Independently check source-frequency ledgers added by the report."""
    with np.load(HERE / "hits.npz", allow_pickle=False) as stored:
        archive = {key: stored[key] for key in stored.files}
    dates, markets = archive["dates"], archive["markets"]
    sources = read("catalogues.json")["sources"]
    selected = {(row["channel"], row["metric"], row["market"]): row for row in read("results.json")["summaries"]}
    intervals = {"weight_train": ("2026-09-08", "2026-09-30"), "weight_validation": ("2026-10-01", "2026-10-15"),
                 "late_reused": ("2026-10-16", "2026-10-22"), "november_reused": ("2026-10-23", "2026-11-01")}
    path = HERE / "selected_source_usage.csv"
    opener = open if path.exists() else gzip.open
    path = path if path.exists() else path.with_suffix(".csv.gz")
    seen, rows_checked = set(), 0
    totals: dict[tuple, int] = {}
    with opener(path, "rt", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["channel"], row["metric"], row["market"])
            channel, metric, market = key
            entry = selected[key]
            index = int(row["source_index"])
            identity = (*key, row["block"], index)
            require(identity not in seen, "Duplicate source-usage row")
            seen.add(identity)
            scope = np.ones(len(dates), dtype=bool) if market == "ALL" else markets == market
            begin, end = intervals[row["block"]]
            routes = archive[f"{channel}__{metric}__routes"][entry["index"]]
            use = scope & (dates >= begin) & (dates <= end) & (routes == index)
            require(int(row["routed_draws"]) == int(use.sum()) and use.any(), "Source routed-draw count differs")
            require(row["policy"] == entry["selected"] and row["source"] == sources[channel][index]["id"] and row["family"] == sources[channel][index]["family"], "Source usage identity differs")
            values = {field: int(row[field]) for field in ("n", "baseline_hits", "candidate_hits", "wins", "losses")}
            matrix = archive[f"{channel}__{metric}"]
            current = matrix[routes, np.arange(len(dates))]
            verify_counts(values, matrix[0], current, use & archive[f"{channel}__{metric}__eligible"])
            total_key = (*key, row["block"])
            totals[total_key] = totals.get(total_key, 0) + int(row["routed_draws"])
            rows_checked += 1
    for key in selected:
        scope = np.ones(len(dates), dtype=bool) if key[2] == "ALL" else markets == key[2]
        for block, (begin, end) in intervals.items():
            require(totals.get((*key, block), 0) == int((scope & (dates >= begin) & (dates <= end)).sum()), "Incomplete source-usage coverage")
    latest_count = 0
    with (HERE / "last_observed_source_choices.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["channel"], row["metric"], row["market"])
            scope = np.ones(len(dates), dtype=bool) if key[2] == "ALL" else markets == key[2]
            position = np.flatnonzero(scope)[-1]
            index = int(archive[f"{key[0]}__{key[1]}__routes"][selected[key]["index"], position])
            require(row["last_observed_date"] == dates[position] and int(row["source_index"]) == index
                    and row["last_observed_source"] == sources[key[0]][index]["id"], "Last observed source differs")
            latest_count += 1
    require(latest_count == len(selected), "Incomplete latest-source ledger")
    return {"source_usage_rows": rows_checked, "last_observed_choices": latest_count}


def main() -> None:
    import run_study as study

    replay = study.load_replay()
    catalogue = read("catalogues.json")
    result = read("results.json")
    manifest_count = audit_manifests(read("selection_manifest.json"))
    require(result["all_dates_reused"] is True, "Missing reused-data disclosure")
    with np.load(HERE / "hits.npz", allow_pickle=False) as stored:
        archive = {key: stored[key] for key in stored.files}
    with np.load(HERE.parent / "combined_prediction_v7/hits.npz", allow_pickle=False) as stored:
        previous = {key: stored[key] for key in stored.files}
    old_catalogue = json.loads((HERE.parent / "combined_prediction_v7/catalogues.json").read_text(encoding="utf-8"))
    old_selection = json.loads((HERE.parent / "combined_prediction_v7/selection.json").read_text(encoding="utf-8"))
    upstream_hash_count = audit_manifests(json.loads((HERE.parent / "combined_prediction_v7/audit_manifest.json").read_text(encoding="utf-8")))
    np.testing.assert_array_equal(archive["dates"], replay.dates)
    np.testing.assert_array_equal(archive["markets"], replay.markets)
    require(len(set(zip(replay.dates, replay.markets))) == len(replay.rows), "Duplicated replay rows")
    require(list(zip(replay.dates, replay.markets)) == sorted(zip(replay.dates, replay.markets)), "Unexpected replay ordering")
    require(len(set(replay.markets)) == 12 and replay.dates[-1] == "2026-11-01", "Unexpected replay coverage")
    periods = {"weight_train": (replay.dates >= "2026-09-08") & (replay.dates <= "2026-09-30"),
               "weight_validation": (replay.dates >= "2026-10-01") & (replay.dates <= "2026-10-15"),
               "late_reused": (replay.dates >= "2026-10-16") & (replay.dates <= "2026-10-22"),
               "november_reused": (replay.dates >= "2026-10-23") & (replay.dates <= "2026-11-01")}
    scopes = {"ALL": np.ones(len(replay.rows), dtype=bool),
              **{market: replay.markets == market for market in sorted(set(replay.markets))}}
    for block, expected in periods.items():
        np.testing.assert_array_equal(study.blocks(replay)[block], expected)
    controllers = study.policies.catalogue()
    require(catalogue["controllers"] == controllers and catalogue["policies"][:len(controllers)] == controllers, "Controller definitions differ")
    synthetic = synthetic_controller_checks(study.policies.route, controllers)
    reconstruction_count = route_count = summary_count = causality_count = 0
    source_picks: dict[str, dict[str, np.ndarray]] = {}
    for channel in study.CHANNELS:
        sources = catalogue["sources"][channel]
        require(len({entry["id"] for entry in sources}) == len(sources), "Duplicate source identifiers")
        native = independent_picks(replay, replay.endpoint_probs(channel, "sp30"))
        native["panel10"] = independent_picks(replay, replay.endpoint_probs(channel, "all10"))["panel10"]
        native["dp20"] = independent_picks(replay, replay.endpoint_probs(channel, "dp20"))["dp20"]
        native_hits, eligibility = independent_hits(replay, channel, native)
        source_picks[channel] = native
        for metric in METRICS:
            np.testing.assert_array_equal(archive[f"{channel}__{metric}"][0], native_hits[metric])
            np.testing.assert_array_equal(archive[f"{channel}__{metric}__eligible"], eligibility[metric])
        for index, entry in enumerate(sources):
            if entry["origin"] not in {"expert", "weights"}:
                continue
            for metric in METRICS:
                np.testing.assert_array_equal(archive[f"{channel}__{metric}"][index], previous[f"{channel}__{entry['origin']}__{metric}"][entry["source_index"]])
        bank = study.static_sources.load_bundles(replay, channel)
        prior_counts = np.array([int(((replay.markets == market) & (replay.dates < day)).sum())
                                 for day, market in zip(replay.dates, replay.markets, strict=True)])[:, None]
        np.testing.assert_array_equal(prior_counts, bank.local_prior_samples)
        blends = [(index, entry) for index, entry in enumerate(sources) if entry["origin"] == "blend"]
        for (index, entry), (generated_meta, generated) in zip(blends, study.static_sources.candidates(replay, channel, bank), strict=True):
            require(entry["id"] == "blend/" + generated_meta["id"], "Blend catalogue order differs")
            rebuilt = independent_static(generated_meta, bank, prior_counts)
            np.testing.assert_allclose(generated, rebuilt, rtol=0, atol=1e-12)
            picks = independent_picks(replay, rebuilt)
            hit, _ = independent_hits(replay, channel, picks)
            for metric in METRICS:
                np.testing.assert_array_equal(archive[f"{channel}__{metric}"][index], hit[metric])
            reconstruction_count += 1
        print(f"Independently verified source budgets and hits: {channel}", flush=True)
    verify_jodi_budget(source_picks["open"]["top5"], source_picks["close_pre"]["top5"])
    for index, entry in enumerate(catalogue["sources"]["jodi_pre"]):
        if entry["family"] == "same_source":
            expected = archive["open__top5"][entry["open_source"]] & archive["close_pre__top5"][entry["close_source"]]
        else:
            expected = archive["open__top5__policy_hits"][entry["open_policy"]] & archive["close_pre__top5__policy_hits"][entry["close_policy"]]
        np.testing.assert_array_equal(archive["jodi_pre__jodi25"][index], expected)
    expected_records = {(channel, metric, market) for channel in study.CHANNELS for metric in METRICS for market in scopes}
    expected_records |= {("jodi_pre", "jodi25", market) for market in scopes}
    records = result["summaries"]
    selection_keys = ("channel", "metric", "market", "selected", "index", "strict_local_index", "selection_mode")
    require(read("selection.json") == [{key: row[key] for key in selection_keys} for row in records], "Frozen selections differ from reports")
    require(len(records) == len(expected_records) and {(row["channel"], row["metric"], row["market"]) for row in records} == expected_records, "Missing or duplicate endpoint summaries")
    for channel, metric in sorted({(row["channel"], row["metric"]) for row in records}):
        matrix = archive[f"{channel}__{metric}"]
        eligible = archive[f"{channel}__{metric}__eligible"]
        routes = archive[f"{channel}__{metric}__routes"]
        method_hits = archive[f"{channel}__{metric}__policy_hits"]
        methods = catalogue["policies"] if channel != "jodi_pre" else controllers
        require(routes.shape == method_hits.shape == (len(methods), len(replay.rows)), "Route/method matrix shape differs")
        require(bool(((routes >= 0) & (routes < len(matrix))).all()), "Invalid stored source index")
        np.testing.assert_array_equal(method_hits, matrix[routes, np.arange(len(replay.rows))[None, :]])
        if channel != "jodi_pre":
            source_catalogue = catalogue["sources"][channel]
            expert_count = len(old_catalogue[channel]["experts"])
            np.testing.assert_array_equal(routes[len(controllers)], np.full(len(replay.rows), expert_count))
            expected_v7 = np.zeros(len(replay.rows), dtype=np.int32)
            for entry in old_selection:
                if entry["channel"] == channel and entry["market"] != "ALL" and entry["index"]:
                    use = (replay.markets == entry["market"]) & (replay.dates >= "2026-10-16")
                    expected_v7[use] = expert_count - 1 + entry["index"]
            np.testing.assert_array_equal(routes[len(controllers) + 1], expected_v7)
            local_equal = [index for index, entry in enumerate(source_catalogue)
                           if entry["origin"] == "blend" and entry["family"] == "static_arithmetic"
                           and entry["parameters"].get("profile") == "equal"
                           and entry["parameters"].get("local_fraction") == 1.0]
            require(len(local_equal) == 1, "Missing unique equal local mixture")
            np.testing.assert_array_equal(routes[len(controllers) + 2], np.full(len(replay.rows), local_equal[0]))
        fit_eligible = eligible & (replay.dates >= "2026-09-08")
        prepared = study.policies.prepare(replay.dates, replay.markets, matrix, fit_eligible)
        for index, policy in enumerate(controllers):
            fresh = study.policies.route(replay.dates, replay.markets, matrix, fit_eligible, policy, prepared=prepared)
            np.testing.assert_array_equal(routes[index], fresh, err_msg=f"Stored route differs for {channel}/{metric}/{policy['id']}")
            route_count += 1
        relevant = [row for row in records if row["channel"] == channel and row["metric"] == metric]
        selected_controllers = [controllers[index] for index in sorted({row["index"] for row in relevant if row["index"] < len(controllers)})]
        causality_count += controller_checks(replay.dates, replay.markets, matrix, fit_eligible, selected_controllers, study.policies.route)["policies"]
        for row in relevant:
            scope = scopes[row["market"]]
            selected, mode = independent_policy_choice(method_hits, eligible, scope, replay.dates)
            require(row["index"] == selected and row["selected"] == methods[selected]["id"] and row["selection_mode"] == mode, "Frozen selector differs")
            require(row["strict_local_index"] == independent_choice(method_hits, eligible, scope, replay.dates), "Strict-local reference differs")
            require(set(row["approaches"]) == {entry["id"] for entry in methods}, "Approach summary coverage differs")
            for index, method in enumerate(methods):
                blocks = row["approaches"][method["id"]]
                require(set(blocks) == set(periods), "Summary block coverage differs")
                for block, period in periods.items():
                    verify_counts(blocks[block], matrix[0], method_hits[index], scope & eligible & period)
                    summary_count += 1
        print(f"Verified routes, chronology, selectors and counts: {channel}/{metric}", flush=True)
    balanced_rows = result["balanced_summaries"]
    require(read("balanced_selection.json") == [{key: row[key] for key in ("channel", "market", "index", "selected")} for row in balanced_rows], "Frozen coherent selections differ from reports")
    expected_balanced = {(channel, market) for channel in study.CHANNELS for market in scopes}
    require(len(balanced_rows) == len(expected_balanced) and {(row["channel"], row["market"]) for row in balanced_rows} == expected_balanced, "Incomplete coherent selectors")
    for channel in study.CHANNELS:
        matrices = {metric: archive[f"{channel}__{metric}"] for metric in METRICS}
        utility = np.zeros(matrices["top5"].shape, dtype=float)
        for metric in METRICS:
            utility += matrices[metric]
        utility /= 5
        for index, entry in enumerate(catalogue["sources"][channel]):
            if entry["origin"] == "weights" and entry["source_index"] in (1, 2):
                utility[index] = utility[0]
        require(bool((utility <= .8 + 1e-12).all()), "Same-draw output-count utility exceeded maximum")
        eligible = np.ones(len(replay.rows), dtype=bool)
        fit_eligible = eligible & (replay.dates >= "2026-09-08")
        prepared = study.policies.prepare(replay.dates, replay.markets, utility, fit_eligible)
        routes = archive[f"{channel}__balanced__routes"]
        for index, policy in enumerate(controllers):
            expected = study.policies.route(replay.dates, replay.markets, utility, fit_eligible, policy, prepared=prepared)
            np.testing.assert_array_equal(routes[index], expected)
            route_count += 1
        outputs = {metric: matrices[metric][routes, np.arange(len(replay.rows))[None, :]] for metric in METRICS}
        for metric in METRICS:
            np.testing.assert_array_equal(outputs[metric], archive[f"{channel}__balanced__{metric}"])
        rows = [row for row in balanced_rows if row["channel"] == channel]
        selected = [controllers[index] for index in sorted({row["index"] for row in rows})]
        causality_count += controller_checks(replay.dates, replay.markets, utility, fit_eligible, selected, study.policies.route)["policies"]
        for row in rows:
            scope = scopes[row["market"]]
            allowed = [0]
            train, validation = periods["weight_train"], periods["weight_validation"]
            if (scope & train).sum() >= 15 and (scope & validation).sum() >= 8:
                for index in range(1, len(controllers)):
                    nonregression = all(outputs[metric][index, scope & period & archive[f"{channel}__{metric}__eligible"]].sum()
                                        >= outputs[metric][0, scope & period & archive[f"{channel}__{metric}__eligible"]].sum()
                                        for metric in METRICS for period in (train, validation))
                    improvement = any(outputs[metric][index, scope & validation & archive[f"{channel}__{metric}__eligible"]].sum()
                                      > outputs[metric][0, scope & validation & archive[f"{channel}__{metric}__eligible"]].sum() for metric in METRICS)
                    if nonregression and improvement:
                        allowed.append(index)
            chosen = min(allowed, key=lambda index: tuple(-int(outputs[metric][index, scope & validation & archive[f"{channel}__{metric}__eligible"]].sum())
                         for metric in ("panel10", "avoid2", "top5", "sp30", "dp20")) + (index != 0, index))
            require(row["index"] == chosen and row["selected"] == controllers[chosen]["id"], "Coherent selector differs")
            for metric in METRICS:
                for block, period in periods.items():
                    verify_counts(row["metrics"][metric][block], matrices[metric][0], outputs[metric][chosen], scope & period & archive[f"{channel}__{metric}__eligible"])
                    summary_count += 1
        print(f"Verified coherent routes, all-five gates and counts: {channel}", flush=True)
    verification = {"status": "pass", "rows": len(replay.rows), "markets": len(scopes) - 1,
                    "static_probability_reconstructions": reconstruction_count,
                    "controller_route_reconstructions": route_count, "summary_count_checks": summary_count,
                    "selected_real_controller_causality_checks": causality_count,
                    "all_policy_synthetic_checks": synthetic, "selection_manifest_hash_checks": manifest_count,
                    "upstream_lineage_hash_checks": upstream_hash_count,
                    "fresh_confirmation": False,
                    "scope": "Independent source mixtures, exact budgets/hits, imported V7 hit identity, route decisions, same-day/future label and eligibility isolation, row ordering, strict/sparse selectors and paired summaries."}
    verification["report_source_usage_checks"] = verify_source_usage()
    study.save("verification.json", verification)
    files = [path for path in HERE.iterdir() if path.is_file() and path.name != "audit_manifest.json"]
    lineage = [HERE.parent / "combined_prediction_v7" / name for name in
               ("audit_manifest.json", "selection_manifest.json", "hits.npz", "specialist_probabilities.npz", "component_selection.json", "selection.json")]
    study.save("audit_manifest.json", {"files": {str(path.relative_to(HERE.parent)): digest(path) for path in [*files, *lineage]}, "fresh_confirmation": False})
    print(json.dumps(verification, indent=2), flush=True)


if __name__ == "__main__":
    main()
