"""Decompose the headline candidates: which term drives the observed deltas?

Also tests the natural reparametrisation (scaling the existing production
`appearance` weight instead of adding `present_soft`) so a gain cannot be
credited to the new signal when it merely rescales an old one.
"""
from pathlib import Path

import numpy as np

from study import Change, Replay, item_hits, paired

HERE = Path(__file__).resolve().parent
replay = Replay()
blocks = ("development", "validation", "audit", "extension")


def line(label: str, item: dict, change: Change) -> None:
    probs = replay.endpoint_probs(item["channel"], item["endpoint"], change)
    base_probs = replay.endpoint_probs(item["channel"], item["endpoint"], Change())
    hits, eligible = item_hits(replay, item, probs)
    base_hits, _ = item_hits(replay, item, base_probs)
    text = []
    for block in blocks:
        stats = paired(replay, base_hits, hits, eligible, getattr(replay, block))
        text.append(f"{block[:3]} {stats['baseline_hits']}->{stats['candidate_hits']}")
    diff = int(hits.sum() - base_hits.sum())
    print(f"{label:52s} {' '.join(text)}  all {diff:+d}")


close_item = {"kind": "derived", "channel": "close_pre", "endpoint": "sp30", "task": "sutta6"}
open_item = {"kind": "derived", "channel": "open", "endpoint": "sp30", "task": "sutta6"}

print("== close_pre sutta6: decomposition ==")
line("present_soft=-2 only", close_item, Change(present_soft=-2.0))
line("kind_tilt=-1 only", close_item, Change(kind_tilt=-1.0))
line("present_soft=-2;kind_tilt=-1 (selected)", close_item, Change(present_soft=-2.0, kind_tilt=-1.0))
line("present_soft=-1", close_item, Change(present_soft=-1.0))
line("present_soft=-2;kind_tilt=+1", close_item, Change(present_soft=-2.0, kind_tilt=1.0))
line("present_soft=+2;kind_tilt=-1", close_item, Change(present_soft=2.0, kind_tilt=-1.0))

print("\n== close_pre sutta6: reparametrised appearance scaling (v1 family, not new) ==")
for weight in (-1.0, -1.5, -2.0, -2.5, -3.0):
    probs = replay.endpoint_probs("close_pre", "sp30", Change())
    # recreate the score with a modified appearance weight via the internal formula
    features = replay.channels["close_pre"]
    weights = replay.production_weights("close_pre", "sp30")
    q = __import__("study").softmax(features["logits"])
    mass = q[:, replay.dp_index].sum(axis=1, keepdims=True)
    adjusted = q.copy()
    adjusted[:, replay.dp_index] = ((1 - weights["dp_blend"][:, None]) * q[:, replay.dp_index]
                                    + weights["dp_blend"][:, None] * mass * features["dp"])
    sutta_mass = adjusted @ replay.sutta_matrix
    digit_mass = adjusted @ replay.digits
    from study import logit
    term_sutta = np.log(features["sutta"] / sutta_mass)[:, replay.sutta]
    term_absent = (logit(features["absent"]) - logit(digit_mass)) @ replay.digits.T
    term_conditional = np.log(features["conditional"] / sutta_mass)[:, replay.sutta]
    scores = (np.log(adjusted)
              + weights["sutta"][:, None] * term_sutta
              + weight * term_absent
              + np.log(weights["avoid_multiplier"])[:, None] * features["avoid_count"]
              + np.log(weights["present_multiplier"])[:, None] * features["present_count"]
              + weights["conditional_close"][:, None] * term_conditional)
    from study import softmax as sm
    probs = sm(scores)
    base_probs = replay.endpoint_probs("close_pre", "sp30", Change())
    hits, eligible = item_hits(replay, close_item, probs)
    base_hits, _ = item_hits(replay, close_item, base_probs)
    text = []
    for block in blocks:
        stats = paired(replay, base_hits, hits, eligible, getattr(replay, block))
        text.append(f"{block[:3]} {stats['baseline_hits']}->{stats['candidate_hits']}")
    print(f"appearance={weight:5.1f} (production sutta/dp as-is)        {' '.join(text)}")

print("\n== jodi_pre decomposition (top6 lists) ==")


def jodi_line(label: str, open_change: Change, close_change: Change) -> None:
    hits = replay.jodi_hits(replay.sutta_order(replay.endpoint_probs("open", "sp30", open_change), 6),
                            replay.sutta_order(replay.endpoint_probs("close_pre", "sp30", close_change), 6))
    base_hits = replay.jodi_hits(replay.sutta_order(replay.endpoint_probs("open", "sp30", Change()), 6),
                                 replay.sutta_order(replay.endpoint_probs("close_pre", "sp30", Change()), 6))
    eligible = np.ones(len(replay.rows), dtype=bool)
    text = []
    for block in blocks:
        stats = paired(replay, base_hits, hits, eligible, getattr(replay, block))
        text.append(f"{block[:3]} {stats['baseline_hits']}->{stats['candidate_hits']}")
    print(f"{label:52s} {' '.join(text)}  all {int(hits.sum() - base_hits.sum()):+d}")


jodi_line("open only (ps=2,kt=-1)", Change(present_soft=2.0, kind_tilt=-1.0), Change())
jodi_line("close_pre only (ps=-2,kt=-1)", Change(), Change(present_soft=-2.0, kind_tilt=-1.0))
jodi_line("both (selected)", Change(present_soft=2.0, kind_tilt=-1.0), Change(present_soft=-2.0, kind_tilt=-1.0))
jodi_line("both, open kept production", Change(), Change(present_soft=-2.0, kind_tilt=-1.0))
