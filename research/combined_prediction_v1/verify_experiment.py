"""Verify probability identities, causal inputs, exact lists, and saved counts."""
from __future__ import annotations

import csv
import json
import subprocess
from collections import Counter

import numpy as np

from run_experiment import HERE, PROTOCOL, Replay, Weights, baseline_for, digest, softmax


def verify_source_and_causality() -> None:
    root = HERE.parents[1]
    metadata = json.loads((HERE / "replay_metadata.json").read_text())
    for relative, expected in metadata["productionSourceHashes"].items():
        assert digest(root / relative) == expected, f"Production source changed: {relative}"
    assert digest(root / PROTOCOL["source"]) == metadata["sourceSHA256"]
    code = r"""
const assert = require('node:assert/strict');
const {loadEvents, exportEvent} = require('./research/combined_prediction_v1/export_replay.cjs');
const {events} = loadEvents();
const target = events.find(e => e.date >= '2026-08-15' && e.market === 'Kalyan');
const histories = {};
for (const e of events) (histories[e.market] ??= []).push(e);
const original = exportEvent(target, histories, true);
// Target Close and every future historical row are deliberately poisoned.
const poisoned = Object.fromEntries(Object.entries(histories).map(([m, rows]) => [m, rows.map(e => e.date < target.date ? e : {
  ...e, open: '111', close: '222', record: {...e.record, openPanel:'111', closePanel:'222', openSutta:3, closeSutta:6, jodi:'36'}
})]));
const changed = exportEvent({...target, close:'222'}, poisoned, true);
assert.deepEqual(original.channels, changed.channels, 'Target/future Close influenced predictions');
assert.deepEqual(original.conditionalClose, changed.conditionalClose);
console.log('Target/future poisoning check passed for all three channels.');
"""
    subprocess.run(["node", "-e", code], cwd=root, check=True)


def verify_probability_identities(replay: Replay) -> None:
    assert len(replay.panels) == 220
    assert Counter(replay.kind) == {"SP": 120, "DP": 90, "TP": 10}
    assert not (replay.development & replay.validation).any()
    assert not ((replay.development | replay.validation) & replay.audit).any()
    assert (replay.development | replay.validation | replay.audit).all()
    for channel in PROTOCOL["channels"]:
        original = replay.channels[channel]["base"]
        np.testing.assert_allclose(softmax(replay.scores(channel, Weights())), original, atol=1e-12)
        corrected = softmax(replay.scores(channel, Weights(sutta=1))) @ replay.sutta_matrix
        np.testing.assert_allclose(corrected, replay.channels[channel]["sutta"], atol=1e-12)
        base = softmax(replay.scores(channel, Weights(dp_blend=1)))
        dp = base[:, replay.dp_index]
        np.testing.assert_allclose(dp / dp.sum(axis=1, keepdims=True), replay.channels[channel]["dp"], atol=1e-12)
        np.testing.assert_allclose(base[:, replay.dp_index].sum(axis=1), original[:, replay.dp_index].sum(axis=1), atol=1e-12)
        assert np.isfinite(replay.scores(channel, Weights(sutta=.5, appearance=.25, avoid_multiplier=.75, present_multiplier=1.25))).all()


def verify_saved_calls(replay: Replay) -> None:
    selection = json.loads((HERE / "selection.json").read_text())
    results = json.loads((HERE / "results.json").read_text())
    manifest = json.loads((HERE / "selection_manifest.json").read_text())
    assert digest(HERE / "selection.json") == manifest["selectionSHA256"] == results["selectionSHA256"]
    assert digest(HERE / "protocol.json") == results["protocolSHA256"]
    calls = list(csv.DictReader((HERE / "audit_calls.csv").open(encoding="utf-8", newline="")))
    assert len(calls) == int(replay.audit.sum()) * len(PROTOCOL["channels"]) * len(PROTOCOL["panel_tasks"])
    unique = set()
    for row in calls:
        key = row["date"], row["market"], row["channel"], row["task"]
        assert key not in unique
        unique.add(key)
        assert PROTOCOL["validation_end"] < row["date"] <= PROTOCOL["end"]
        kind, count = PROTOCOL["panel_tasks"][row["task"]]
        panels = row["global_panels"].split()
        routed_panels = row["routed_panels"].split()
        assert len(panels) == len(set(panels)) == count
        assert len(routed_panels) == len(set(routed_panels)) == count
        assert all(p in replay.panel_index for p in panels + routed_panels)
        if kind != "all":
            assert all(replay.kind[replay.panel_index[p]] == kind for p in panels + routed_panels)
        assert int(row["global_hit"]) == int(row["actual"] in panels)
        assert int(row["routed_hit"]) == int(row["actual"] in routed_panels)
    for channel in PROTOCOL["channels"]:
        for task in PROTOCOL["panel_tasks"]:
            spec = selection["channels"][channel]["tasks"][task]
            stats = results["channels"][channel][task]["blocks"]["audit"]
            scores = replay.scores(channel, Weights(**spec["selected"]))
            hit, eligible = replay.hits(channel, task, scores)
            base_hit, _ = replay.hits(channel, task, replay.scores(channel, baseline_for(task)))
            use = replay.audit & eligible
            assert stats["global"]["n"] == int(use.sum())
            assert stats["global"]["candidate_hits"] == int(hit[use].sum())
            assert stats["global"]["baseline_hits"] == int(base_hit[use].sum())
            # Independent explicit sorting checks the vectorized rank evaluator.
            kind, count = PROTOCOL["panel_tasks"][task]
            allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
            for i in np.flatnonzero(replay.audit):
                picks = sorted(allowed, key=lambda p: (-scores[i, p], p))[:count]
                assert bool(hit[i]) == (replay.actual(channel)[i] in picks)
            for market, route in spec["market_routes"].items():
                assert route["development_net_hits"] >= PROTOCOL["market_route"]["minimum_development_net_hits"]
                assert route["validation_net_hits"] >= PROTOCOL["market_route"]["minimum_validation_net_hits"]


def main() -> None:
    verify_source_and_causality()
    replay = Replay(include_audit=True)
    verify_probability_identities(replay)
    verify_saved_calls(replay)
    print(f"Verified {len(replay.rows)} events, all frozen selected calls, list sizes/kinds, source hashes, and probability identities.")


if __name__ == "__main__":
    main()
