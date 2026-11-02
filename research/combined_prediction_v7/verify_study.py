"""Independent list, budget, selector and frozen-artifact checks for V7."""
from __future__ import annotations

import hashlib
import copy
import itertools
import json
import os
from pathlib import Path
from typing import Any

for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[variable] = "1"

import numpy as np

import run_study as study

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
    """Build universes from panel text, rather than borrowing runner features."""
    panels = list(replay.panels)
    n = len(replay.rows)
    require(probabilities.shape == (n, 220), "Unexpected probability shape")
    require(np.isfinite(probabilities).all() and (probabilities > 0).all(), "Invalid probabilities")
    np.testing.assert_allclose(probabilities.sum(axis=1), 1, atol=1e-10, rtol=0)
    sutta = np.array([sum(map(int, panel)) % 10 for panel in panels])
    kinds = np.array(["SP" if len(set(p)) == 3 else "DP" if len(set(p)) == 2 else "TP" for p in panels])
    pairs = np.array(list(itertools.combinations(range(10), 2)))
    absent = np.array([[str(a) not in p and str(b) not in p for a, b in pairs] for p in panels])
    marginal = probabilities @ np.eye(10)[sutta]
    picks = {"top5": np.argsort(-np.round(marginal, 12), axis=1, kind="stable")[:, :5],
             "avoid2": pairs[np.argmax(np.round(probabilities @ absent, 12), axis=1)]}
    for metric, kind, count in (("panel10", None, 10), ("sp30", "SP", 30), ("dp20", "DP", 20)):
        universe = np.arange(220) if kind is None else np.flatnonzero(kinds == kind)
        picks[metric] = universe[np.argsort(-np.round(probabilities[:, universe], 12), axis=1, kind="stable")[:, :count]]
    for metric, count in (("top5", 5), ("avoid2", 2), ("panel10", 10), ("sp30", 30), ("dp20", 20)):
        require(picks[metric].shape == (n, count), f"Wrong {metric} budget")
        require(np.all(np.diff(np.sort(picks[metric], axis=1), axis=1) > 0), f"Duplicate {metric} picks")
    return picks


def independent_hits(replay: Any, channel: str, picks: dict[str, np.ndarray]) -> tuple[dict, dict]:
    actual = replay.actual(channel)
    panels = np.asarray(replay.panels)
    text = panels[actual]
    sutta = np.array([sum(map(int, p)) % 10 for p in text])
    kinds = np.array(["SP" if len(set(p)) == 3 else "DP" if len(set(p)) == 2 else "TP" for p in text])
    eligible = {metric: np.ones(len(actual), dtype=bool) for metric in METRICS}
    eligible["sp30"], eligible["dp20"] = kinds == "SP", kinds == "DP"
    hits = {"top5": (picks["top5"] == sutta[:, None]).any(axis=1),
            "avoid2": np.array([all(str(d) not in panel for d in pair) for panel, pair in zip(text, picks["avoid2"], strict=True)])}
    for metric in ("panel10", "sp30", "dp20"):
        hits[metric] = (picks[metric] == actual[:, None]).any(axis=1) & eligible[metric]
    return hits, eligible


def independent_jodi(replay: Any, open_picks: np.ndarray, close_picks: np.ndarray) -> np.ndarray:
    pairs = (10 * open_picks[:, :, None] + close_picks[:, None, :]).reshape(-1, 25)
    require(np.all(np.diff(np.sort(pairs, axis=1), axis=1) > 0), "Jodi budget must be 25 distinct pairs")
    actual_open = np.array([sum(map(int, replay.panels[i])) % 10 for i in replay.actual("open")])
    actual_close = np.array([sum(map(int, replay.panels[i])) % 10 for i in replay.actual("close_pre")])
    return (pairs == (10 * actual_open + actual_close)[:, None]).any(axis=1)


def expert_choice(matrix: np.ndarray, eligible: np.ndarray, scope: np.ndarray, dates: np.ndarray) -> int:
    train = scope & eligible & (dates <= "2026-08-16")
    val = scope & eligible & (dates >= "2026-08-17") & (dates <= "2026-09-07")
    if train.sum() < 15 or val.sum() < 8:
        return 0
    survivors = [0]
    for index in range(1, len(matrix)):
        delta = matrix[index].astype(int) - matrix[0].astype(int)
        if delta[train].sum() >= 0 and delta[val].sum() > 0:
            survivors.append(index)
    return min(survivors, key=lambda i: (-int(matrix[i, val].sum()), i != 0, -int(matrix[i, train].sum()), i))


def verify_jodi_choices(replay: Any, archive: dict, catalogue: dict, early: list, final: list,
                        scopes: dict, periods: dict, qualified: Any, matrix: Any, eligibility: Any) -> None:
    require(len(early) == len(scopes) == len(final), 'Missing Jodi scope')
    require({r['market'] for r in early} == set(scopes) == {r['market'] for r in final}, 'Jodi scopes differ')
    for stage, rows in (('expert',early),('weights',final)):
        op, cp = matrix('open',stage)['top5'], matrix('close_pre',stage)['top5']
        base = op[0] & cp[0]
        specialist = op[1] & cp[1] if stage == 'weights' else base
        if stage == 'weights':
            np.testing.assert_array_equal(base,archive['jodi_baseline'])
            np.testing.assert_array_equal(specialist,archive['jodi_specialists'])
        for row in rows:
            scope = scopes[row['market']]
            train = scope & periods['development' if stage == 'expert' else 'weight_train']
            val = scope & periods['validation' if stage == 'expert' else 'weight_validation']
            options = {}
            for channel in ('open','close_pre'):
                h = matrix(channel,stage)['top5']
                if stage == 'expert':
                    allowed = [i for i in range(1,len(h)) if h[i,train].sum() >= h[0,train].sum() and h[i,val].sum() >= h[0,val].sum()]
                    options[channel] = [0]+sorted(allowed,key=lambda i:(-int(h[i,val].sum()),-int(h[i,train].sum()),i))[:8]
                else:
                    allowed = [i for i in range(1,len(h)) if qualified(matrix(channel,stage),eligibility(channel),scope,i)]
                    options[channel] = [0]+sorted(allowed,key=lambda i:(-int(h[i,val].sum()),i))[:12]
            candidates = [(0,0)]
            if train.sum() >= 15 and val.sum() >= 8:
                for a,b in itertools.product(options['open'],options['close_pre']):
                    if stage == 'weights' and (a == 0 or b == 0):
                        continue
                    hits = op[a] & cp[b]
                    if hits[train].sum() >= max(base[train].sum(),specialist[train].sum()) and hits[val].sum() > max(base[val].sum(),specialist[val].sum()):
                        candidates.append((a,b))
            selected = min(candidates,key=lambda p:(-int((op[p[0]] & cp[p[1]])[val].sum()),p != (0,0),-int((op[p[0]] & cp[p[1]])[train].sum()),p))
            require(selected == (row['open_index'],row['close_index']), f'{stage} Jodi selection mismatch')
            for channel,index,field in (('open',selected[0],'open_candidate'),('close_pre',selected[1],'close_candidate')):
                require(catalogue[channel]['experts' if stage == 'expert' else 'weights'][index]['id'] == row[field], 'Jodi candidate ID mismatch')


def verify_summaries(results: dict, selections: list, jodi: list, matrix: Any, eligibility: Any,
                     scopes: dict, periods: dict) -> int:
    require(results['all_dates_reused'] is True, 'Outcome reuse disclosure missing')
    require(len(results['summaries']) == len(selections), 'Summary count differs')
    chosen = {(r['channel'],r['market']):r for r in selections}
    checks = 0
    def check(blocks: dict, base: np.ndarray, specialists: np.ndarray, current: np.ndarray, eligible: np.ndarray, scope: np.ndarray) -> None:
        nonlocal checks
        require(set(blocks) == set(periods), 'Summary periods missing')
        for name,mask in periods.items():
            use = scope & eligible & mask
            expected = {'n':int(use.sum()),'baseline_hits':int(base[use].sum()),'specialist_hits':int(specialists[use].sum()),
                        'candidate_hits':int(current[use].sum()),'wins':int((current & ~base & use).sum()),'losses':int((base & ~current & use).sum())}
            for key,value in expected.items():
                require(blocks[name][key] == value, f'Summary {name}/{key} differs')
            checks += 1
    for row in results['summaries']:
        entry = chosen[row['channel'],row['market']]
        require(row['index'] == entry['index'] and row['candidate'] == entry['candidate'], 'Summary changed selected candidate')
        require(set(row['metrics']) == set(METRICS), 'Missing companion endpoint')
        mats, eligible = matrix(row['channel'],'weights'), eligibility(row['channel'])
        for metric in METRICS:
            check(row['metrics'][metric],mats[metric][0],mats[metric][1],mats[metric][row['index']],eligible[metric],scopes[row['market']])
    chosen_jodi = {r['market']:r for r in jodi}
    require(len(results['jodi_summaries']) == len(chosen_jodi), 'Missing Jodi summaries')
    op,cp = matrix('open','weights')['top5'],matrix('close_pre','weights')['top5']
    for row in results['jodi_summaries']:
        entry = chosen_jodi[row['market']]
        require((row['open_index'],row['close_index']) == (entry['open_index'],entry['close_index']), 'Jodi summary changed selection')
        check(row['blocks'],op[0]&cp[0],op[1]&cp[1],op[row['open_index']]&cp[row['close_index']],np.ones(op.shape[1],dtype=bool),scopes[row['market']])
    return checks


def main() -> None:
    replay = study.load_replay()
    with np.load(HERE / "hits.npz", allow_pickle=False) as stored:
        archive = {key: stored[key] for key in stored.files}
    with np.load(HERE / "specialist_probabilities.npz", allow_pickle=False) as stored:
        bundles = {key: stored[key] for key in stored.files}
    catalogue = read("catalogues.json")
    components, selections = read("component_selection.json"), read("selection.json")
    jodi_components, jodi_selections = read("jodi_specialist_selection.json"), read("jodi_selection.json")
    manifest = read("selection_manifest.json")
    for name, expected in manifest["files"].items():
        require(digest(HERE / name) == expected, f"Frozen file changed: {name}")
    freeze = read("component_freeze.json")
    require(freeze["componentSHA256"] == digest(HERE / "component_selection.json"), "Component freeze mismatch")
    require(freeze["jodiSHA256"] == digest(HERE / "jodi_specialist_selection.json"), "Jodi freeze mismatch")
    require(freeze["frozenAtUTC"] <= manifest["frozenAtUTC"], "Components were not frozen before final selection")
    np.testing.assert_array_equal(archive["dates"], replay.dates)
    np.testing.assert_array_equal(archive["markets"], replay.markets)
    periods = {"development": replay.dates <= "2026-08-16",
               "validation": (replay.dates >= "2026-08-17") & (replay.dates <= "2026-09-07"),
               "weight_train": (replay.dates >= "2026-09-08") & (replay.dates <= "2026-09-30"),
               "weight_validation": (replay.dates >= "2026-10-01") & (replay.dates <= "2026-10-15"),
               "late_reused": (replay.dates >= "2026-10-16") & (replay.dates <= "2026-10-22"),
               "november_reused": replay.dates >= "2026-10-23"}
    scopes = {"ALL": np.ones(len(replay.rows), dtype=bool), **{m: replay.markets == m for m in sorted(set(replay.markets))}}
    for block in periods:
        np.testing.assert_array_equal(periods[block], study.blocks(replay)[block])
    expected = {(c, m, s) for c in study.CHANNELS for m in METRICS for s in scopes}
    require(len(components) == len(expected) and {(r['channel'], r['metric'], r['market']) for r in components} == expected, "Incomplete component scopes")
    require(len(selections) == len(scopes)*3 and len({(r['channel'],r['market']) for r in selections}) == len(selections), "Incomplete fusion scopes")
    def matrix(channel: str, stage: str) -> dict:
        return {m: archive[f"{channel}__{stage}__{m}"] for m in METRICS}
    def eligibility(channel: str) -> dict:
        return {m: archive[f"{channel}__expert__{m}__eligible"] for m in METRICS}
    def qualified(matrices: dict, eligible: dict, scope: np.ndarray, index: int) -> bool:
        return all(int(matrices[m][index, scope & periods[b] & eligible[m]].sum()) >=
                   max(int(matrices[m][j, scope & periods[b] & eligible[m]].sum()) for j in (0, 1))
                   for m in METRICS for b in ("weight_train", "weight_validation"))
    for row in components:
        channel, metric, market = row['channel'], row['metric'], row['market']
        chosen = expert_choice(matrix(channel, 'expert')[metric], eligibility(channel)[metric], scopes[market], replay.dates)
        require(chosen == row['index'] and catalogue[channel]['experts'][chosen]['id'] == row['candidate'], "Component choice mismatch")
    for row in selections:
        channel, scope = row['channel'], scopes[row['market']]
        mats, eligible = matrix(channel,'weights'), eligibility(channel)
        val = scope & periods['weight_validation']
        valid = [i for i in range(1,len(mats['top5'])) if qualified(mats,eligible,scope,i) and
                 any(mats[m][i,val & eligible[m]].sum() > max(mats[m][j,val & eligible[m]].sum() for j in (0,1)) for m in METRICS)]
        chosen = min(valid, key=lambda i: tuple(-int(mats[m][i,val & eligible[m]].sum()) for m in ('panel10','avoid2','top5','sp30','dp20'))+(i,)) if valid and (scope & periods['weight_train']).sum() >= 15 and val.sum() >= 8 else 0
        require(row['index'] == chosen and row['candidate'] == catalogue[channel]['weights'][chosen]['id'], "Fusion choice mismatch")
    reconstructions = 0
    selected_probabilities = {}
    selected_fusions = {}
    for channel in study.CHANNELS:
        native = independent_picks(replay,replay.endpoint_probs(channel,'sp30'))
        for metric, endpoint in (('panel10','all10'),('dp20','dp20')):
            native[metric] = independent_picks(replay,replay.endpoint_probs(channel,endpoint))[metric]
        base, eligible = independent_hits(replay,channel,native)
        for metric in METRICS:
            np.testing.assert_array_equal(base[metric], matrix(channel,'expert')[metric][0])
            np.testing.assert_array_equal(eligible[metric], eligibility(channel)[metric])
            np.testing.assert_array_equal(eligible[metric], archive[f'{channel}__weights__{metric}__eligible'])
        wanted = {r['candidate'] for r in components if r['channel'] == channel}
        wanted |= {r['open_candidate'] if channel == 'open' else r['close_candidate'] for r in jodi_components} if channel != 'close_known' else set()
        source_arrays = {'production': replay.endpoint_probs(channel,'sp30')}
        for i,(metadata,p) in enumerate(study.experts.candidates(replay,channel),1):
            require(metadata['id'] == catalogue[channel]['experts'][i]['id'], "Expert catalogue order changed")
            outputs = independent_picks(replay,p)
            actual_hits,_ = independent_hits(replay,channel,outputs)
            for metric in METRICS:
                np.testing.assert_array_equal(actual_hits[metric], matrix(channel,'expert')[metric][i])
            if metadata['id'] in wanted:
                source_arrays[metadata['id']] = p.copy()
            reconstructions += 1
        selected_probabilities[channel] = source_arrays
        bundle = {m: bundles[f'{channel}__{m}'] for m in (*METRICS,'baseline','jodi')}
        for row in components:
            if row['channel'] == channel and row['market'] != 'ALL':
                metric, scope = row['metric'], scopes[row['market']]
                source = source_arrays[row['candidate']] if row['index'] else replay.endpoint_probs(channel, {'panel10':'all10','dp20':'dp20'}.get(metric,'sp30'))
                np.testing.assert_array_equal(bundle[metric][scope],source[scope])
        for row in jodi_components:
            if row['market'] != 'ALL' and channel != 'close_known':
                cid = row['open_candidate'] if channel == 'open' else row['close_candidate']
                np.testing.assert_array_equal(bundle['jodi'][scopes[row['market']]],source_arrays[cid][scopes[row['market']]])
        for index,outputs in ((0,native),(1,{m: independent_picks(replay,bundle[m])[m] for m in METRICS}),
                              (2,{m: independent_picks(replay,bundle['jodi'] if m == 'top5' else bundle[m])[m] for m in METRICS})):
            actual_hits,_ = independent_hits(replay,channel,outputs)
            for metric in METRICS:
                np.testing.assert_array_equal(actual_hits[metric],matrix(channel,'weights')[metric][index])
        for i,(metadata,p) in enumerate(study.weights.candidates(replay,channel,bundle),3):
            require(metadata['id'] == catalogue[channel]['weights'][i]['id'], "Weight catalogue order changed")
            actual_hits,_ = independent_hits(replay,channel,independent_picks(replay,p))
            for metric in METRICS:
                np.testing.assert_array_equal(actual_hits[metric],matrix(channel,'weights')[metric][i])
            if any(r['channel'] == channel and r['index'] == i for r in selections) or any(r['open_index' if channel == 'open' else 'close_index'] == i for r in jodi_selections if channel != 'close_known'):
                selected_fusions[channel,i] = p.copy()
            reconstructions += 1
        print(f'Independently reconstructed {channel}',flush=True)
    # Cartesian pair hit must equal the conjunction, without actual-Open conditioning.
    for left,right in ((0,0),(1,1),(2,2)):
        op = independent_picks(replay,bundles['open__jodi' if left == 2 else 'open__top5'])['top5'] if left else independent_picks(replay,replay.endpoint_probs('open','sp30'))['top5']
        cp = independent_picks(replay,bundles['close_pre__jodi' if right == 2 else 'close_pre__top5'])['top5'] if right else independent_picks(replay,replay.endpoint_probs('close_pre','sp30'))['top5']
        np.testing.assert_array_equal(independent_jodi(replay,op,cp), matrix('open','weights')['top5'][left] & matrix('close_pre','weights')['top5'][right])
    verify_jodi_choices(replay,archive,catalogue,jodi_components,jodi_selections,scopes,periods,qualified,matrix,eligibility)
    checks = verify_summaries(read('results.json'),selections,jodi_selections,matrix,eligibility,scopes,periods)
    prefix = study.Replay.from_rows([r for r in replay.rows if r['date'] <= '2026-10-22'])
    prefix_positions = np.flatnonzero(replay.dates <= '2026-10-22')
    altered_rows = copy.deepcopy(replay.rows)
    for row in altered_rows:
        if row['date'] >= '2026-09-01':
            row['actualOpen'] = '111' if row['actualOpen'] != '111' else '222'
            row['actualClose'] = '333' if row['actualClose'] != '333' else '444'
    altered = study.Replay.from_rows(altered_rows)
    before = replay.dates <= '2026-09-01'
    stability_checks = causality_checks = 0
    for channel in study.CHANNELS:
        chosen_sources = selected_probabilities[channel]
        for metadata,p in study.experts.candidates(prefix,channel):
            if metadata['id'] in chosen_sources:
                np.testing.assert_allclose(p,chosen_sources[metadata['id']][prefix_positions],rtol=0,atol=1e-12)
                # Exact rounded lists must remain stable, including tied controls.
                old = independent_picks(prefix,chosen_sources[metadata['id']][prefix_positions])
                new = independent_picks(prefix,p)
                for metric in METRICS:
                    np.testing.assert_array_equal(old[metric],new[metric])
                stability_checks += 1
        for metadata,p in study.experts.candidates(altered,channel):
            if metadata['id'] in chosen_sources:
                np.testing.assert_array_equal(np.round(p[before],12),np.round(chosen_sources[metadata['id']][before],12))
                causality_checks += 1
        prefix_bundle = {m: bundles[f'{channel}__{m}'][prefix_positions] for m in (*METRICS,'baseline','jodi')}
        for index,(_,p) in enumerate(study.weights.candidates(prefix,channel,prefix_bundle),3):
            if (channel,index) in selected_fusions:
                old = independent_picks(prefix,selected_fusions[channel,index][prefix_positions])
                new = independent_picks(prefix,p)
                for metric in METRICS:
                    np.testing.assert_array_equal(old[metric],new[metric])
                stability_checks += 1
    audit = {'status':'pass','rows':len(replay.rows),'distribution_reconstructions':reconstructions,'component_selectors':len(components),
             'weight_selectors':len(selections),'jodi_selectors':len(jodi_selections),'summary_checks':checks,'fresh_confirmation':False,
             'selected_source_prefix_checks':stability_checks,'selected_source_no_future_label_checks':causality_checks,
             'scope':'Independent exact budgets, rounded ranking, hits, routed sources, selectors and all summary counts; no claim of fresh confirmation.'}
    study.save('verification.json',audit)
    source_files = [HERE/name for name in ('verify_study.py','report_study.py','run_study.py','experts.py','weights.py','selection_manifest.json','hits.npz','specialist_probabilities.npz','results.json')]
    source_files += [HERE/name for name in ('REPORT.md','market_summary.csv','jodi_summary.csv','ablation_summary.csv','aggregate_routed.csv')]
    source_files += [HERE.parent/name for name in ('combined_prediction_v3/study.py','combined_prediction_v5/method_candidates.py','combined_prediction_v6/candidates.py')]
    source_files += [HERE.parent/name for name in ('combined_prediction_v1/replay.jsonl.gz','combined_prediction_v1/replay_metadata.json',
                      'combined_prediction_v2/extension_replay.jsonl.gz','combined_prediction_v2/extension_replay_metadata.json',
                      'combined_prediction_v3/fresh_replay.jsonl.gz','combined_prediction_v3/fresh_replay_metadata.json',
                      'combined_prediction_v5/fresh_replay.jsonl.gz','combined_prediction_v5/fresh_replay_metadata.json',
                      'combined_prediction_v6/extension_replay.jsonl.gz','combined_prediction_v6/extension_replay_metadata.json',
                      'combined_prediction_v3/production_policy.json','combined_prediction_v3/protocol.json')]
    study.save('audit_manifest.json',{'files':{str(path.relative_to(HERE.parent)):digest(path) for path in source_files},'fresh_confirmation':False})
    print(json.dumps(audit,indent=2))


if __name__ == "__main__":
    main()
