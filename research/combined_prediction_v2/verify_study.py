"""Verify causal context, adapters, ranking budgets and frozen study artifacts."""
from __future__ import annotations

import argparse
import copy
import csv
import gzip
import hashlib
import json

import numpy as np

from wide_models import HERE, PROTOCOL, ROOT, Candidate, Context, StudyReplay, history_rows, score, sha, softmax
from wide_search import TASKS, baseline_indices, online_forecast, outcomes, warmup_pool


def subset(replay: StudyReplay, index: int) -> StudyReplay:
    result = copy.copy(replay)
    n = len(replay.rows)
    for key, value in replay.__dict__.items():
        if isinstance(value, np.ndarray) and len(value) == n:
            setattr(result, key, value[index:index+1])
    result.rows = [replay.rows[index]]
    result.channels = {c: {k: v[index:index+1] for k, v in values.items()} for c, values in replay.channels.items()}
    result._base_cache = {}
    return result


def causal_checks(replay: StudyReplay, records: list[dict]) -> None:
    index = next(i for i, row in enumerate(replay.rows) if row["market"] == "Kalyan" and row["date"] >= "2026-08-17")
    small = subset(replay, index)
    target = small.rows[0]["date"]
    poisoned = [r | {"open": "000", "close": "111"} if r["date"] > target or (r["date"] == target and r["market"] == "Milan Night") else r for r in records]
    for channel in PROTOCOL["channels"]:
        original = Context(small, channel, records)
        future = Context(small, channel, poisoned)
        for name in original.features:
            np.testing.assert_allclose(original.features[name], future.features[name], err_msg=f"Future/later-market leak: {channel} {name}")
        for name in original.states:
            np.testing.assert_array_equal(original.states[name], future.states[name])
    original = Context(small, "open", records)
    changed = []
    for row in records:
        if row["market"] == "Sridevi" and row["date"] == target:
            row = row | {"open": "111" if row["open"] != "111" else "000"}
        changed.append(row)
    earlier = Context(small, "open", changed)
    assert not np.allclose(original.features["live_digits"], earlier.features["live_digits"]), "Earlier scheduled observation should change live context"
    own_open_changed = [r | {"open": "000"} if r["date"] == target and r["market"] == "Kalyan" else r for r in records]
    for channel in ("open", "close_pre"):
        original, changed_context = Context(small, channel, records), Context(small, channel, own_open_changed)
        for name in original.features:
            np.testing.assert_allclose(original.features[name], changed_context.features[name], err_msg=f"Undeclared own Open leaked: {channel} {name}")
    print("Causal context checks passed, including later-market exclusion and earlier-source admission.")


def historical_checks(replay: StudyReplay, records: list[dict]) -> None:
    for channel in PROTOCOL["channels"]:
        candidates = [Candidate(**c) for c in json.loads((HERE / f"catalogue_{channel}.json").read_text())]
        hits = np.load(HERE / f"history_{channel}.npz")["hits"]
        oof = np.load(HERE / f"oof_{channel}.npz")
        context = Context(replay, channel, records)
        all_control, dp_control = baseline_indices(candidates)
        for index in (all_control, dp_control):
            np.testing.assert_array_equal(outcomes(replay, channel, score(context, candidates[index])), hits[index])
        family_examples = {}
        for i, candidate in enumerate(candidates):
            family_examples.setdefault(candidate.family, i)
        for i in family_examples.values():
            values = oof[str(i)] if str(i) in oof.files else score(context, candidates[i])
            assert np.isfinite(values).all()
            np.testing.assert_array_equal(outcomes(replay, channel, values), hits[i])
            for task in TASKS:
                kind, count = PROTOCOL["tasks"][task]
                allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
                for row_index in (0, len(replay.rows)//2, len(replay.rows)-1):
                    picks = sorted(allowed, key=lambda p: (-values[row_index, p], p))[:count]
                    assert len(picks) == len(set(picks)) == count
                    assert hits[i, row_index, TASKS.index(task)] == (replay.actual(channel)[row_index] in picks)
        for i, candidate in enumerate(candidates):
            if candidate.family != "ridge_stack" or not candidate.parameters["dp_only"]:
                continue
            mask = replay.kind == "DP"
            np.testing.assert_allclose(oof[str(i)][:, ~mask], context.base_log[:, ~mask], atol=1e-12)
            final = score(context, candidate)
            np.testing.assert_allclose(final[:, ~mask], context.base_log[:, ~mask], atol=1e-12)
            np.testing.assert_allclose(np.exp(final[:, mask]).sum(axis=1), context.q[:, mask].sum(axis=1), atol=1e-12)
        # A poisoned future reward stream must not alter any earlier routing.
        task = "all30"
        ti = TASKS.index(task)
        pool = warmup_pool(replay, hits, candidates, ti, all_control)
        probabilities = np.stack([softmax(-__import__("wide_models").stable_ranks(score(context, candidates[i])) / 40) for i in pool])
        args = (replay, channel, task, hits, pool, probabilities, all_control, 30, 20, 2, True)
        original, choices = online_forecast(*args)
        poisoned = hits.copy()
        poisoned[:, replay.dates > "2026-08-20"] = ~poisoned[:, replay.dates > "2026-08-20"]
        future, future_choices = online_forecast(replay, channel, task, poisoned, pool, probabilities, all_control, 30, 20, 2, True)
        earlier = replay.dates <= "2026-08-20"
        np.testing.assert_array_equal(original[earlier], future[earlier])
        np.testing.assert_array_equal(choices[earlier], future_choices[earlier])
        print(f"Verified {channel}: {len(candidates)} candidates, every family, DP preservation and online causality.")


def frozen_checks() -> None:
    manifest = json.loads((HERE / "freeze_manifest.json").read_text())
    for filename, expected in manifest["files"].items():
        assert sha(HERE / filename) == expected, f"Frozen artifact changed: {filename}"
    for filename, expected in manifest["productionSourceHashes"].items():
        assert sha(ROOT / filename) == expected, f"Production source changed: {filename}"
    if (HERE / "extension_source_audit.json").exists():
        audit = json.loads((HERE / "extension_source_audit.json").read_text())
        assert sha(HERE / "october_rows.csv") == audit["csvSHA256"]
        assert audit["frozen_policySHA256"] == sha(HERE / "frozen_policy.json")
        assert len(audit["markets"]) == 12
        for market in audit["markets"].values():
            assert market["overlap"] >= PROTOCOL["fresh_source_minimum_overlap"]
            assert market["identity"] >= PROTOCOL["fresh_source_minimum_identity"]
    if (HERE / "extension_replay.jsonl.gz").exists():
        raw = gzip.decompress((HERE / "extension_replay.jsonl.gz").read_bytes())
        meta = json.loads((HERE / "extension_replay_metadata.json").read_text())
        assert hashlib.sha256(raw).hexdigest() == meta["sha256"]
        for row in (json.loads(line) for line in raw.splitlines()):
            assert PROTOCOL["extension_start"] <= row["date"] <= PROTOCOL["extension_end"]
            assert row["historyMaxDate"] < row["date"]
    if (HERE / "extension_calls.csv").exists():
        records = list(csv.DictReader((HERE / "extension_calls.csv").open(encoding="utf-8", newline="")))
        replay = StudyReplay(extension=True)
        keys = set()
        for row in records:
            key = tuple(row[k] for k in ("date", "market", "channel", "task", "policy"))
            assert key not in keys
            keys.add(key)
            panels = row["panels"].split()
            kind, count = PROTOCOL["tasks"][row["task"]]
            assert len(panels) == len(set(panels)) == count
            assert all(p in replay.panel_index for p in panels)
            assert kind == "all" or all(replay.kind[replay.panel_index[p]] == kind for p in panels)
            assert int(row["hit"]) == int(row["actual"] in panels)
        print(f"Verified {len(records)} exact October panel calls.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pre-freeze", action="store_true")
    args = parser.parse_args()
    replay, records = StudyReplay(), history_rows()
    causal_checks(replay, records)
    historical_checks(replay, records)
    if not args.pre_freeze:
        frozen_checks()
    print("Research verification passed.")


if __name__ == "__main__":
    main()
