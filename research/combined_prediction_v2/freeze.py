"""Seal all selected rules before admitting October outcomes."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import numpy as np

from wide_models import HERE, PROTOCOL, ROOT, Candidate, Context, StudyReplay, history_rows, save_json, score, sha, softmax


def main() -> None:
    if (HERE / "october_rows.csv").exists():
        raise RuntimeError("October outcomes already exist. Do not reselect this study's policies.")
    replay = StudyReplay()
    policy = {"study": PROTOCOL["study"], "development_through": PROTOCOL["development_end"], "channels": {}, "confidence_gates": {}, "secondary": json.loads((HERE / "secondary_policy.json").read_text()), "v1_selectionSHA256": sha(HERE.parent / "combined_prediction_v1/selection.json")}
    for channel in PROTOCOL["channels"]:
        policy["channels"][channel] = json.loads((HERE / f"selection_{channel}.json").read_text())
        candidates = [Candidate(**c) for c in json.loads((HERE / f"catalogue_{channel}.json").read_text())]
        context = Context(replay, channel, history_rows())
        oof = np.load(HERE / f"oof_{channel}.npz")
        gates = {}
        for task, spec in policy["channels"][channel]["static"]["tasks"].items():
            index = spec["global_stable"]
            scores = oof[str(index)] if str(index) in oof.files else score(context, candidates[index])
            kind, count = PROTOCOL["tasks"][task]
            allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
            q = softmax(scores[:, allowed])
            order = np.argsort(-q, axis=1, kind="stable")
            ordered = np.take_along_axis(q, order, axis=1)
            features = {"topk_mass": ordered[:, :count].sum(axis=1), "boundary_margin": ordered[:, count-1] - ordered[:, count], "model_agreement": context.states["agreement"]}
            gates[task] = []
            for name, values in features.items():
                for quantile in PROTOCOL["confidence_quantiles"]:
                    threshold = float(np.quantile(values, quantile))
                    gates[task].append({"feature": name, "quantile": quantile, "threshold": threshold, "comparison": ">="})
        policy["confidence_gates"][channel] = gates
    save_json(HERE / "frozen_policy.json", policy)
    files = ["protocol.json", "wide_models.py", "wide_search.py", "secondary_search.py", "frozen_policy.json", "secondary_policy.json"]
    files += [f"{prefix}_{channel}.json" for channel in PROTOCOL["channels"] for prefix in ("catalogue", "selection")]
    save_json(HERE / "freeze_manifest.json", {"frozenAtUTC": datetime.now(timezone.utc).isoformat(), "files": {name: sha(HERE / name) for name in files}, "sourceSHA256": sha(ROOT / PROTOCOL["source"]), "v1ReplaySHA256": replay.meta["replaySHA256"], "productionSourceHashes": replay.meta["productionSourceHashes"]})
    print(f"FROZEN {sha(HERE / 'frozen_policy.json')}. October outcomes may now be fetched.")


if __name__ == "__main__":
    main()
