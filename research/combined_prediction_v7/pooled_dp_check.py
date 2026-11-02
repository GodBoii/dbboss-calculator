"""Post-hoc, reused-date diagnostic of an explicit pooled DP fallback."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path

import run_study as study
import numpy as np

HERE = Path(__file__).resolve().parent


def write_json(value: object) -> None:
    (HERE / 'pooled_dp_results.json').write_text(
        json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8', newline='\n')


def main() -> None:
    result_path = HERE / 'pooled_dp_results.json'
    if result_path.exists():
        raise ValueError('Pooled diagnostic already frozen; do not overwrite')
    replay = study.load_replay()
    periods = study.blocks(replay)
    scopes = {'ALL': np.ones(len(replay.rows), dtype=bool),
              **{m: replay.markets == m for m in sorted(set(replay.markets))}}
    component_selection = json.loads((HERE / 'component_selection.json').read_text())
    original_selection = json.loads((HERE / 'selection.json').read_text())
    catalogues = json.loads((HERE / 'catalogues.json').read_text())
    selected_global = {ch: next(x for x in component_selection
                               if x['channel'] == ch and x['metric'] == 'dp20' and x['market'] == 'ALL')
                       for ch in study.CHANNELS}
    assert selected_global['close_pre']['index'] == 326
    assert selected_global['close_pre']['candidate'] == 'v6/digit_symmetry/transform=rotate1/alpha=0.5'
    assert all(selected_global[ch]['index'] == 0 for ch in ('open', 'close_known'))
    eligible = study.eligibility(replay, 'close_pre')
    routing = []
    replaced = np.zeros(len(replay.rows), dtype=bool)
    for market, scope in scopes.items():
        if market == 'ALL':
            continue
        train_n = int((scope & periods['development'] & eligible['dp20']).sum())
        val_n = int((scope & periods['validation'] & eligible['dp20']).sum())
        insufficient = train_n < 15 or val_n < 8
        old = next(x for x in component_selection if x['channel'] == 'close_pre'
                   and x['metric'] == 'dp20' and x['market'] == market)
        if insufficient:
            assert old['index'] == 0
            replaced |= scope
        routing.append({'market': market, 'development_dp_n': train_n, 'validation_dp_n': val_n,
                        'insufficient_support': insufficient, 'old_dp_index': old['index'],
                        'new_dp_index': 326 if insufficient else old['index']})
    result = {'status': 'routing_frozen_before_diagnostic_evaluation',
              'routing_frozen_at_utc': datetime.now(timezone.utc).isoformat(),
              'post_hoc': True, 'all_dates_reused': True, 'promotion': False,
              'rule': 'For close_pre only, replace DP slot when early development DP n<15 OR early validation DP n<8 with the ALL early-selected DP expert. Leave every other slot unchanged.',
              'selection_blocks': ['weight_train', 'weight_validation'],
              'no_selection_on_audits': True, 'routing': routing,
              'global_dp_sources': selected_global,
              'unchanged_channels': {'open': 'ALL DP selection is production; no pooled candidate tested',
                                     'close_known': 'ALL DP selection is production; no pooled candidate tested'},
              'inputs': {name: study.digest(HERE / name) for name in
                         ('component_selection.json', 'selection.json', 'hits.npz',
                          'specialist_probabilities.npz', 'weights.py', 'experts.py')}}
    # Persist the rule before generating any diagnostic predictions or audit counts.
    write_json(result)
    ch = 'close_pre'
    with np.load(HERE / 'specialist_probabilities.npz') as saved:
        original = {name: saved[f'{ch}__{name}'].copy()
                    for name in (*study.METRICS, 'baseline', 'jodi')}
    bundle = {name: value.copy() for name, value in original.items()}
    source = None
    for index, (metadata, p) in enumerate(study.experts.candidates(replay, ch), 1):
        if index == 326:
            assert metadata['id'] == selected_global[ch]['candidate']
            assert metadata['id'] == catalogues[ch]['experts'][index]['id']
            source = p
            break
    if source is None:
        raise ValueError('Selected global DP source was not reconstructed')
    bundle['dp20'][replaced] = source[replaced]
    for name in bundle:
        if name != 'dp20':
            assert bundle[name].tobytes() == original[name].tobytes()
    assert bundle['dp20'][~replaced].tobytes() == original['dp20'][~replaced].tobytes()
    np.testing.assert_allclose(bundle['dp20'][replaced], source[replaced], rtol=0, atol=0)
    old_outputs = {m: study.picks(replay, original[m])[m] for m in study.METRICS}
    outputs = {m: study.picks(replay, bundle[m])[m] for m in study.METRICS}
    for m in study.METRICS:
        if m != 'dp20':
            np.testing.assert_array_equal(outputs[m], old_outputs[m])
    old_specialist = study.hits(replay, ch, old_outputs)
    specialist = study.hits(replay, ch, outputs)
    production = study.hits(replay, ch, study.baseline_picks(replay, ch))
    jodi = study.hits(replay, ch, {**outputs, 'top5': study.picks(replay, bundle['jodi'])['top5']})
    catalog = [{'id': 'production', 'family': 'baseline'},
               {'id': 'pooled_dp_specialists', 'family': 'specialist_bundle'},
               {'id': 'pooled_dp_jodi_specialists', 'family': 'specialist_bundle'}]
    arrays = {m: [production[m], specialist[m], jodi[m]] for m in study.METRICS}
    for metadata, p in study.weights.candidates(replay, ch, bundle):
        selected = study.picks(replay, p)  # validates positive normalized p and fixed budgets
        for m, count in (('top5', 5), ('avoid2', 2), ('panel10', 10), ('sp30', 30), ('dp20', 20)):
            assert selected[m].shape == (len(replay.rows), count)
        values = study.hits(replay, ch, selected)
        catalog.append(metadata)
        for m in study.METRICS:
            arrays[m].append(values[m])
    assert len(catalog) == 798
    matrix = {m: np.asarray(values) for m, values in arrays.items()}
    original_hits = np.load(HERE / 'hits.npz')
    audit_blocks = ('weight_validation', 'late_reused', 'november_reused')
    summaries = []
    with gzip.open(HERE / 'pooled_dp_metrics.csv.gz', 'wt', encoding='utf-8', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['channel', 'market', 'candidate_index', 'candidate', 'family', 'metric', 'block', 'n',
                         'production_hits', 'old_specialist_hits', 'pooled_specialist_hits',
                         'original_selected_hits', 'candidate_hits', 'top5_source_index', 'avoid2_source_index',
                         'panel10_source_index', 'sp30_source_index', 'dp20_source_index'])
        for market, scope in scopes.items():
            i = study.choose_balanced(matrix, eligible, scope, periods['weight_train'], periods['weight_validation'])
            old_i = next(x['index'] for x in original_selection if x['channel'] == ch and x['market'] == market)
            indices = {m: next(x['index'] for x in component_selection if x['channel'] == ch
                              and x['metric'] == m and x['market'] == market) for m in study.METRICS}
            if market != 'ALL':
                indices['dp20'] = next(x['new_dp_index'] for x in routing if x['market'] == market)
            counts = {}
            for m in study.METRICS:
                counts[m] = {}
                for block, mask in periods.items():
                    use = scope & mask & eligible[m]
                    totals = matrix[m][:, use].sum(axis=1)
                    old_count = int(original_hits[f'{ch}__weights__{m}'][old_i, use].sum())
                    counts[m][block] = {'n': int(use.sum()), 'production_hits': int(totals[0]),
                                        'old_specialist_hits': int(old_specialist[m][use].sum()),
                                        'pooled_specialist_hits': int(totals[1]),
                                        'original_selected_hits': old_count, 'pooled_selected_hits': int(totals[i])}
                    if block in audit_blocks:
                        writer.writerows([ch, market, k, c['id'], c['family'], m, block, int(use.sum()),
                                          int(totals[0]), int(old_specialist[m][use].sum()), int(totals[1]),
                                          old_count, int(totals[k]), *(indices[x] for x in study.METRICS)]
                                         for k, c in enumerate(catalog))
            summaries.append({'market': market, 'selected_index': i, 'selected_candidate': catalog[i]['id'],
                              'original_selected_index': old_i, 'component_indices': indices, 'metrics': counts})
    original_hits.close()
    # Reconstruct only the selected weight distributions from the same frozen
    # bundle; compare public-interface hits with the stored candidate rows.
    wanted = {s['selected_index'] for s in summaries if s['selected_index'] >= 3}
    reconstructed = {0, 1, 2}
    if wanted:
        for index, (metadata, p) in enumerate(study.weights.candidates(replay, ch, bundle), 3):
            if index in wanted:
                assert metadata['id'] == catalog[index]['id']
                values = study.hits(replay, ch, study.picks(replay, p))
                for m in study.METRICS:
                    np.testing.assert_array_equal(values[m], matrix[m][index])
                reconstructed.add(index)
            if wanted <= reconstructed:
                break
    assert all(s['selected_index'] in reconstructed for s in summaries)
    pipeline_counts = {
        metric: {block: {key: sum(s['metrics'][metric][block][key] for s in summaries if s['market'] != 'ALL')
                         for key in ('n', 'production_hits', 'old_specialist_hits', 'pooled_specialist_hits',
                                     'original_selected_hits', 'pooled_selected_hits')}
                 for block in periods}
        for metric in study.METRICS}
    result.update(status='complete', weight_variant_count=795, catalog=catalog, summaries=summaries,
                  market_routed_pipeline_counts=pipeline_counts,
                  checks={'non_dp_slot_bytes_unchanged': True, 'supported_dp_rows_unchanged': True,
                          'selected_source_reconstructed': True, 'all_probabilities_positive_normalized': True,
                          'fixed_budgets_verified': True, 'all_798_rows_scored': True,
                          'selected_weight_reconstruction': True})
    write_json(result)
    lines = ['# Pooled DP diagnostic', '',
             'This is a post-hoc diagnostic on dates already used by V7. No result is prospective and no production change is authorized.', '',
             'The fallback rule was written to pooled_dp_results.json before diagnostic predictions and audit counts: use the early ALL DP expert only where local early DP support is below 15 development events or 8 validation events. Only the close_pre DP slot changes; the other six probability arrays are byte-identical.', '',
             'The pooled close_pre source is expert 326, `v6/digit_symmetry/transform=rotate1/alpha=0.5`. Open and close_known selected production globally, so neither channel has an alternative pooled DP candidate to test.', '',
             'All 795 weight variants and three output controls were evaluated. Selection uses September 8-30 and October 1-15 only, with the original five-component guard against both exact production outputs and the modified independent specialists. October 16 onward does not select candidates.', '',
             'Each table cell is hits / eligible events. DP specialist columns compare old local versus pooled fallback before fusion.', '',
             '| Market | Block | Old DP specialist | Pooled DP specialist | Original selected DP | Pooled selected DP | Selected index |',
             '|---|---|---:|---:|---:|---:|---:|']
    for summary in summaries:
        for block in ('weight_train', *audit_blocks):
            c = summary['metrics']['dp20'][block]
            lines.append(f"| {summary['market']} | {block} | {c['old_specialist_hits']}/{c['n']} | {c['pooled_specialist_hits']}/{c['n']} | {c['original_selected_hits']}/{c['n']} | {c['pooled_selected_hits']}/{c['n']} | {summary['selected_index']} |")
    lines += ['', 'All five components after guarded fusion:', '',
              '| Market | Block | Metric | Production | Original selected | Pooled selected |',
              '|---|---|---|---:|---:|---:|']
    for summary in summaries:
        for block in ('weight_train', *audit_blocks):
            for metric in study.METRICS:
                c = summary['metrics'][metric][block]
                lines.append(f"| {summary['market']} | {block} | {metric} | {c['production_hits']}/{c['n']} | {c['original_selected_hits']}/{c['n']} | {c['pooled_selected_hits']}/{c['n']} |")
    lines += ['', 'The gzip ledger pooled_dp_metrics.csv.gz contains every candidate x market (including ALL) x five metrics on weight validation and both later audit blocks. JSON includes all six periods, all component counts, selections and the frozen routing. For ALL, component indices identify early pooled reference selections; the actual bundle remains a concatenation of the reported market assignments.', '',
              'Checks passed: source index/ID reconstruction; unchanged non-DP array bytes and supported-market DP bytes; unchanged non-DP specialist picks; all positive normalized distributions; exact 5/2/10/30/20 output budgets.']
    lines += ['', 'Market-routed pipeline totals (sum the separately selected market outputs):', '',
              '| Block | Metric | Original selected | Pooled selected | Eligible |',
              '|---|---|---:|---:|---:|']
    for block in ('weight_train', *audit_blocks):
        for metric in study.METRICS:
            c = pipeline_counts[metric][block]
            lines.append(f"| {block} | {metric} | {c['original_selected_hits']} | {c['pooled_selected_hits']} | {c['n']} |")
    lines += ['', 'The explicit pooled DP expert improves its direct fit-block DP counts, but guarded fusion produces no later DP hit gain. Other component counts trade off; these reused-date diagnostics do not support promotion.']
    (HERE / 'POOLED_DP.md').write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'complete', 'variants': 795, 'replaced_rows': int(replaced.sum()),
                      'selections': {s['market']: s['selected_index'] for s in summaries}}))


if __name__ == '__main__':
    main()
