"""Decision snapshot of frozen V8 candidates; no fitting or winner selection."""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

import numpy as np

HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'combined_prediction_v8'
METRICS=('top5','avoid2','panel10','sp30','dp20')
LABELS={'top5':'Top-5 Sutta','avoid2':'Avoid-two','panel10':'Panel-10','sp30':'SP-30','dp20':'DP-20'}
CHANNELS=('open','close_pre','close_known')
CHANNEL_LABELS={'open':'Open','close_pre':'Close before Open','close_known':'Close after Open'}


def paired_counts(base: np.ndarray,candidate: np.ndarray,use: np.ndarray) -> dict:
    if base.shape!=candidate.shape or base.shape!=use.shape:raise ValueError('Mismatched paired observations')
    n=int(use.sum());before=int(base[use].sum());after=int(candidate[use].sum())
    return {'n':n,'production_hits':before,'candidate_hits':after,'extra_hits':after-before,
            'production_pct':100*before/n if n else None,'candidate_pct':100*after/n if n else None,
            'lift_pp':100*(after-before)/n if n else None}


def main() -> None:
    results=json.loads((SOURCE/'results.json').read_text())
    manifest=json.loads((SOURCE/'selection_manifest.json').read_text())
    for name,expected in manifest['files'].items():
        if hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()!=expected:raise ValueError(f'Frozen file changed: {name}')
    with np.load(SOURCE/'hits.npz',allow_pickle=False) as handle:archive={k:handle[k] for k in handle.files}
    dates,markets=archive['dates'],archive['markets']
    periods={'oct16_22':(dates>='2026-10-16')&(dates<='2026-10-22'),
             'oct23_nov1':(dates>='2026-10-23')&(dates<='2026-11-01'),
             'oct16_nov1':(dates>='2026-10-16')&(dates<='2026-11-01')}
    records=[];summary=[]
    for market in results['markets']:
        local=[r for r in results['balanced_summaries'] if r['market']==market]
        indices={r['channel']:r['index'] for r in local}
        if set(indices)!=set(CHANNELS):raise ValueError(f'Incomplete market {market}')
        for strategy in ('coherent_combined','endpoint_specific'):
            for channel in CHANNELS:
                for metric in METRICS:
                    reference=archive[f'{channel}__{metric}'][0]
                    if strategy=='coherent_combined':
                        row=next(r for r in local if r['channel']==channel)
                        candidate=archive[f'{channel}__balanced__{metric}'][row['index']]
                    else:
                        row=next(r for r in results['summaries'] if (r['market'],r['channel'],r['metric'])==(market,channel,metric))
                        candidate=archive[f'{channel}__{metric}__policy_hits'][row['index']]
                    eligible=archive[f'{channel}__{metric}__eligible']
                    for period,mask in periods.items():
                        counts=paired_counts(reference,candidate,mask & (markets==market) & eligible)
                        if strategy=='coherent_combined' and period!='oct16_nov1':
                            old=row['metrics'][metric]['late_reused' if period=='oct16_22' else 'november_reused']
                            if (counts['production_hits'],counts['candidate_hits'],counts['n'])!=(old['baseline_hits'],old['candidate_hits'],old['n']):raise ValueError('Archived summary mismatch')
                        records.append({'market':market,'strategy':strategy,'channel':channel,'metric':metric,'period':period,
                                        'policy':row['selected'],**counts})
            reference=archive['open__top5'][0]&archive['close_pre__top5'][0]
            if strategy=='coherent_combined':
                candidate=archive['open__balanced__top5'][indices['open']]&archive['close_pre__balanced__top5'][indices['close_pre']]
                policy=f"Open={indices['open']}; Close-pre={indices['close_pre']}"
            else:
                row=next(r for r in results['summaries'] if (r['market'],r['channel'],r['metric'])==(market,'jodi_pre','jodi25'))
                candidate=archive['jodi_pre__jodi25__policy_hits'][row['index']];policy=row['selected']
            for period,mask in periods.items():
                records.append({'market':market,'strategy':strategy,'channel':'jodi_pre','metric':'jodi25','period':period,
                                'policy':policy,**paired_counts(reference,candidate,mask & (markets==market))})
        endpoint_indices={ch:next(r['index'] for r in results['summaries'] if (r['market'],r['channel'],r['metric'])==(market,ch,'top5')) for ch in ('open','close_pre')}
        endpoint_joint=archive['open__top5__policy_hits'][endpoint_indices['open']]&archive['close_pre__top5__policy_hits'][endpoint_indices['close_pre']]
        for period,mask in periods.items():
            records.append({'market':market,'strategy':'endpoint_top5_jodi','channel':'jodi_pre','metric':'jodi25','period':period,
                            'policy':f"Open endpoint={endpoint_indices['open']}; Close-pre endpoint={endpoint_indices['close_pre']}",
                            **paired_counts(reference,endpoint_joint,mask & (markets==market))})
        primary=[r for r in records if r['market']==market and r['strategy']=='coherent_combined' and r['period']=='oct23_nov1']
        n=next(r['n'] for r in primary if r['metric']=='jodi25')
        improved=[r for r in primary if r['extra_hits']>0];regressed=[r for r in primary if r['extra_hits']<0]
        summary.append({'market':market,'complete_draws':n,'improved_outputs':len(improved),'regressed_outputs':len(regressed),
                        'unchanged_outputs':len(primary)-len(improved)-len(regressed) if n else 0,
                        'status':'no later data' if not n else 'mixed or worse: do not promote whole candidate' if regressed else 'no observed gain' if not improved else 'positive counts; prospective confirmation required'})
    fields=list(records[0])
    with (HERE/'market_comparison.csv').open('w',encoding='utf-8',newline='') as handle:
        writer=csv.DictWriter(handle,fieldnames=fields);writer.writeheader();writer.writerows(records)
    def find(market,strategy,channel,metric,period='oct23_nov1'):
        return next(r for r in records if (r['market'],r['strategy'],r['channel'],r['metric'],r['period'])==(market,strategy,channel,metric,period))
    def changes(market,channel):
        values=[find(market,'coherent_combined',channel,m) for m in METRICS]
        changed=[f"{LABELS[r['metric']]} {r['extra_hits']:+d}" for r in values if r['extra_hits']]
        return '; '.join(changed) if changed else 'Unchanged'
    def cell(r):
        if not r['n']:return 'No data'
        return f"{r['production_hits']}/{r['n']} to {r['candidate_hits']}/{r['n']} ({r['lift_pp']:+.1f} pp)"
    lines=['# Twelve-market production decision snapshot','',
           'Production has not changed. This report compares its hits with the latest frozen research candidates; gains from different studies are not cumulative. No new model is selected or fitted here.','',
           'The decision table uses coherent market/channel policies selected from September fitting and October 1-15 validation. Jodi25 is recomputed from those SAME combined Open and Close-before-Open Top-5 lists. It is not substituted with a separately selected Jodi expert.','',
           'All observations are reused research data. The latest period is October 23-November 1, 2026, with 88 complete market-date records across 11 markets. Earlier October 16-22 comparison and the combined October 16-November 1 period are retained in the CSV. Missing events are not losses or successful predictions.','',
           'There is no defensible single percentage improvement for a market across unlike outputs. Sutta, avoid digits, panels, SP/DP and Jodi use different prediction budgets; SP/DP also have different eligible denominators. Each is shown separately.','',
           '## All twelve markets: latest-period changes','',
           'Component entries are extra correct draws versus production, NOT percentage points. Unlisted components stayed equal. Jodi cells show exact paired counts and percentage-point change.','',
           '| Market | Completed draws | Open changes | Close before Open changes | Close after Open changes | Jodi25 from the same combined Top-5 |',
           '|---|---:|---|---|---|---|']
    for s in summary:
        m=s['market'];n=s['complete_draws']
        lines.append(f"| {m} | {n} | "+' | '.join(changes(m,ch) if n else 'No data' for ch in CHANNELS)+f" | {cell(find(m,'coherent_combined','jodi_pre','jodi25'))} |")
    lines+=['','## What this means for a production decision','',
            '- Sridevi Open is the clearest partial-upgrade candidate. Its latest Sutta is unchanged; avoid-two, panels, SP and DP gain hits. However, the selected Close-after-Open policy regresses, so the full Sridevi bundle should not be treated as one improvement.',
            '- Rajdhani Night Close-before-Open gains Sutta and SP hits, but Jodi25 from the same combined Top-5 falls from 2/6 to 1/6 in the latest period. Its earlier Jodi improved from 1/5 to 2/5. That reversal changes the interpretation of the earlier component-only lead.',
            '- Kalyan, Kalyan Night and Sridevi Night have regressions in the tested complete candidates. Gains in one output do not justify replacing the entire model.',
            '- Several markets have no measured change in the coherent candidate even though separate endpoint-specialist experiments had gains. Those are different strategies and must not be combined into one claimed model.',
            '- Madhur Night has zero later completed records. Its improvement is unknown.',
            '- Keep production unchanged while reviewing these candidates. A selective Sridevi Open trial is a research option, not a confirmed production improvement. No deployment or automatic switch occurs in this report.','',
            '## Detailed coherent-candidate results for each market','',
            'Every cell below gives production hits to candidate hits on the same eligible draws. Percentage-point lift is candidate accuracy minus production accuracy, not relative percentage growth.','']
    for s in summary:
        m=s['market'];lines += [f'### {m}','','| Output | Open | Close before Open | Close after Open |','|---|---|---|---|']
        for metric in METRICS:lines.append('| '+LABELS[metric]+' | '+' | '.join(cell(find(m,'coherent_combined',ch,metric)) for ch in CHANNELS)+' |')
        lines += ['',f"Combined Top-5 Jodi25: {cell(find(m,'coherent_combined','jodi_pre','jodi25'))}.",
                  f"Earlier October 16-22 Jodi25: {cell(find(m,'coherent_combined','jodi_pre','jodi25','oct16_22'))}.",'']
    lines+=['## Separate endpoint strategies, for comparison','',
            'These are independently selected per-output approaches. Their specialized Jodi does not necessarily use the Top-5 lists from the coherent combined policy above. They are retained for research review, not added to the combined candidate gains.','',
            '| Market | Endpoint gains, latest period | Endpoint losses, latest period | Specialized Jodi25 |','|---|---|---|---|']
    for s in summary:
        m=s['market'];values=[r for r in records if r['market']==m and r['strategy']=='endpoint_specific' and r['period']=='oct23_nov1' and r['metric']!='jodi25']
        gains='; '.join(f"{CHANNEL_LABELS[r['channel']]} {LABELS[r['metric']]} {r['extra_hits']:+d}" for r in values if r['extra_hits']>0) or ('None' if s['complete_draws'] else 'No data')
        losses='; '.join(f"{CHANNEL_LABELS[r['channel']]} {LABELS[r['metric']]} {r['extra_hits']:+d}" for r in values if r['extra_hits']<0) or ('None' if s['complete_draws'] else 'No data')
        lines.append(f"| {m} | {gains} | {losses} | {cell(find(m,'endpoint_specific','jodi_pre','jodi25'))} |")
    lines+=['','`market_comparison.csv` preserves both strategies, all 16 outputs per market, exact denominators and both later periods. `snapshot.json` contains the machine-readable decision summary.','',
            'The source hit bank and frozen selections come from combined_prediction_v8. Earlier studies remain the experimental lineage; this report uses the latest declared candidates instead of cherry-picking each market\'s best previously inspected outcome.','']
    lines+=['## Jodi from the separately routed Top-5 lists','',
            'This additional comparison recomputes Jodi from the frozen independent Open/Close Top-5 endpoint routes. It differs from BOTH the coherent combined Top-5 and the independently selected Jodi predictor above. No new winner is fitted. A gain here is still a retrospective result, not a production recommendation.','',
            '| Market | Production to Jodi from endpoint Top-5 routes |','|---|---|']
    for s in summary:
        lines.append(f"| {s['market']} | {cell(find(s['market'],'endpoint_top5_jodi','jodi_pre','jodi25'))} |")
    (HERE/'PRODUCTION_DECISION.md').write_text('\n'.join(lines),encoding='utf-8',newline='\n')
    snapshot={'data_end':'2026-11-01','latest_period':['2026-10-23','2026-11-01'],'all_dates_reused':True,
              'production_changed':False,'source_sha256':{name:hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ('results.json','hits.npz','selection_manifest.json')},
              'summary':summary,'records':records}
    (HERE/'snapshot.json').write_text(json.dumps(snapshot,indent=2,allow_nan=False)+'\n',encoding='utf-8',newline='\n')
    assert len(records)==12*(2*16+1)*3
    assert sum(s['complete_draws'] for s in summary)==88
    assert next(s for s in summary if s['market']=='Madhur Night')['complete_draws']==0
    j=find('Rajdhani Night','coherent_combined','jodi_pre','jodi25')
    assert (j['production_hits'],j['candidate_hits'],j['n'])==(2,1,6)
    print(json.dumps({'markets':len(summary),'comparison_rows':len(records),'paired_archive_checks':'pass','latest_market_date_events':88}))


if __name__=='__main__':main()
