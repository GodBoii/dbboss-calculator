"""Describe component and fusion counts without selecting from audit outcomes."""
from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import numpy as np

HERE = Path(__file__).resolve().parent
METRICS = ("top5", "avoid2", "panel10", "sp30", "dp20")
BLOCKS = ("development", "validation", "weight_train", "weight_validation", "late_reused", "november_reused")


def read(name: str) -> Any:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def cell(result: dict) -> str:
    n = result["n"]
    if not n:
        return "— (n=0)"
    base, specialist, fused = (result[k] for k in ("baseline_hits", "specialist_hits", "candidate_hits"))
    return f"{base} → {specialist} → {fused} / {n} ({fused-base:+d}; {fused-specialist:+d})"


def ablation_report() -> list[str]:
    """Matched fixed reference, rather than comparing separately optimized winners."""
    catalogue = read('catalogues.json')
    with np.load(HERE / 'hits.npz', allow_pickle=False) as archive:
        arrays = {key:archive[key] for key in archive.files}
    dates, markets = arrays['dates'],arrays['markets']
    blocks = {'weight_validation':(dates >= '2026-10-01') & (dates <= '2026-10-15'),
              'late_reused':(dates >= '2026-10-16') & (dates <= '2026-10-22'),
              'november_reused':dates >= '2026-10-23'}
    scopes = {'ALL':np.ones(len(dates),dtype=bool),**{m:markets == m for m in sorted(set(markets))}}
    indices = {ch:{c['parameters']['omitted']:i for i,c in enumerate(values['weights']) if c['family'] == 'component_ablation'}
               for ch,values in catalogue.items()}
    ledger = []
    for channel in catalogue:
        for omitted in METRICS:
            for metric in METRICS:
                matrix = arrays[f'{channel}__weights__{metric}']
                eligible = arrays[f'{channel}__weights__{metric}__eligible']
                for market,scope in scopes.items():
                    for block,mask in blocks.items():
                        used = scope & mask & eligible
                        ref = int(matrix[indices[channel]['none'],used].sum())
                        removed = int(matrix[indices[channel][omitted],used].sum())
                        ledger.append({'channel':channel,'omitted':omitted,'metric':metric,'market':market,'block':block,
                                       'n':int(used.sum()),'reference_hits':ref,'without_component_hits':removed,'retaining_component_net_hits':ref-removed})
    for omitted in METRICS:
        for market,scope in scopes.items():
            for block,mask in blocks.items():
                used = scope & mask
                def joint(key: str) -> int:
                    return int((arrays['open__weights__top5'][indices['open'][key]] & arrays['close_pre__weights__top5'][indices['close_pre'][key]])[used].sum())
                ref,removed = joint('none'),joint(omitted)
                ledger.append({'channel':'preopen_jodi','omitted':omitted,'metric':'jodi25','market':market,'block':block,
                               'n':int(used.sum()),'reference_hits':ref,'without_component_hits':removed,'retaining_component_net_hits':ref-removed})
    with (HERE / 'ablation_summary.csv').open('w',encoding='utf-8',newline='') as handle:
        writer = csv.DictWriter(handle,fieldnames=list(ledger[0]))
        writer.writeheader()
        writer.writerows(ledger)
    lines = ['', '## Which component weights helped or hurt', '',
             'This matched diagnostic compares the fixed ablation reference (`omitted=none`) with removal of every use of one specialist, including its panel-mixture contribution. These are fixed reference weights, not independently optimized winners. Positive net hits mean retaining that component helped this reference; negative values mean removal helped. This does not establish a causal or durable benefit of the component, and interactions can change the result under other weights.', '',
             'Endpoint tuples are Top-5 / avoid-two / panel10 / SP30 / DP20 net hits. Different denominators remain separate and these numbers must not be summed into overall accuracy. `ablation_summary.csv` contains each market, endpoint and denominator, including paired Open/Close-pre Jodi ablations.', '',
             '| Channel | Removed specialist | Weight validation | October 16–22 reused | October 23–November 1 reused |', '|---|---|---|---|---|']
    lookup = {(r['channel'],r['omitted'],r['metric'],r['block']):r['retaining_component_net_hits'] for r in ledger if r['market'] == 'ALL'}
    for channel in (*catalogue,'preopen_jodi'):
        for omitted in METRICS:
            cells = [' / '.join(f"{lookup[channel,omitted,m,b]:+d}" for m in (('jodi25',) if channel == 'preopen_jodi' else METRICS)) for b in blocks]
            lines.append(f'| {channel} | {omitted} | ' + ' | '.join(cells) + ' |')
    return lines


def main() -> None:
    results = read("results.json")
    summaries = results["summaries"]
    fallback_count = sum(row['index'] == 0 for row in summaries)
    route_count = sum(row['index'] in (1,2) for row in summaries)
    ledger = []
    for row in summaries:
        for metric, blocks in row["metrics"].items():
            for block, counts in blocks.items():
                n = counts["n"]
                ledger.append({"channel": row["channel"], "market": row["market"],
                               "candidate": row["candidate"], "index": row["index"],
                               "metric": metric, "block": block, **counts,
                               "net_vs_production": counts["candidate_hits"] - counts["baseline_hits"],
                               "net_vs_specialists": counts["candidate_hits"] - counts["specialist_hits"],
                               "production_rate_pct": 100 * counts["baseline_hits"] / n if n else "",
                               "specialist_rate_pct": 100 * counts["specialist_hits"] / n if n else "",
                               "candidate_rate_pct": 100 * counts["candidate_hits"] / n if n else ""})
    fields = list(dict.fromkeys(key for row in ledger for key in row))
    with (HERE / "market_summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(ledger)
    lines = ["# V7 component-first and weighted fusion study", "",
             "Production is unchanged. Every outcome through November 1 was available to earlier research. This study has no fresh confirmation period; all reported gains are retrospective and exploratory.", "",
             "Each channel first selects specialists separately for Top-5 Sutta, two absent digits, panel Top-10, SP-30 and DP-20. Stage-one training ends August 16; validation is August 17–September 7. Weighted fusion is then selected using September 8–30 training and October 1–15 validation. October 16–22 is reused diagnostic history; October 23–November 1 is reused audit history. No audit outcome is used by the declared selectors, but this chronological separation cannot undo earlier outcome reuse.", "",
             "A nonfallback balanced candidate must preserve all five component hit counts in both fusion-selection blocks against production and independently routed specialists, with a strict validation gain in at least one component. Every component is checked separately on its own eligible events; a gain in one cannot offset a loss in another. Later regressions remain visible. A coherent fused distribution may erase gains from independent output routing.", "",
             f"{fallback_count} of {len(summaries)} channel/scope selectors fall back to production because no qualifying fusion improves on both references. A production fallback can lose specialist gains and does not prove production beats those specialists. {route_count} selectors retain an independently routed output bundle rather than one coherent fused distribution.", "",
             "The market-specific minimum of 15 eligible training and eight eligible validation observations can force sparse SP/DP component selectors to production. Pooled specialist selections are recorded but are not substituted into these market-routed bundles. A retained production component is not evidence that all alternatives fail. Added historical count features omit five raw-only context records available to upstream production features, limiting attribution.", "",
             "Budgets are exactly five Sutta digits, two distinct absent digits, 10 of 220 panels, 30 of 120 SP panels and 20 of 90 DP panels. SP and DP rates condition on the actual panel kind; their denominators differ. Counts are pooled directly over eligible rows and rates are never averaged across endpoints or markets. Ranking rounds scores to 12 decimal places before stable universe-order tie breaking.", "",
             "Cells show production → independent specialists → selected weighted output / eligible events, followed by weighted net hits versus production and versus specialists. Every fusion uses the market-routed source specialists. Pooled and market selectors can choose different fusion weights. Pooled results sum eligible events directly.", "",
             "## Pooled component endpoints", "",
             "| Channel | Endpoint | Weight validation | October 16–22 reused | October 23–November 1 reused |",
             "|---|---|---|---|---|"]
    for row in summaries:
        if row["market"] == "ALL":
            for metric in METRICS:
                values = row["metrics"][metric]
                lines.append(f"| {row['channel']} | {metric} | " + " | ".join(cell(values[b]) for b in BLOCKS[3:]) + " |")
    routed = []
    lines += ['', '## Applying the market-specific fusion overrides', '',
              'This applies each market’s own frozen fusion choice, then sums its hit counts and eligible events. It differs from the ALL selector above, which chooses one fusion setting globally. These are pooled event counts, never averages of market rates. `aggregate_routed.csv` preserves all six blocks.', '',
              '| Channel | Endpoint | Weight validation | October 16–22 reused | October 23–November 1 reused |', '|---|---|---|---|---|']
    for channel in dict.fromkeys(row['channel'] for row in summaries):
        for metric in METRICS:
            totals = {}
            for block in BLOCKS:
                totals[block] = {key:sum(r['metrics'][metric][block][key] for r in summaries if r['channel'] == channel and r['market'] != 'ALL')
                                 for key in ('n','baseline_hits','specialist_hits','candidate_hits')}
                routed.append({'channel':channel,'metric':metric,'block':block,**totals[block]})
            lines.append(f'| {channel} | {metric} | ' + ' | '.join(cell(totals[b]) for b in BLOCKS[3:]) + ' |')
    with (HERE / 'aggregate_routed.csv').open('w',encoding='utf-8',newline='') as handle:
        writer = csv.DictWriter(handle,fieldnames=list(routed[0]))
        writer.writeheader()
        writer.writerows(routed)
    lines += ["", "## Specialists before fusion", "",
              "The following training and validation results belong to component selection, before any fusion weights are chosen. The complete CSV retains these blocks and every later block for each market. Cells show production → routed component specialist / eligible events (specialist net hits).", "",
              "| Channel | Endpoint | Early training | Early validation | October 23–November 1 reused |", "|---|---|---|---|---|"]
    for row in summaries:
        if row['market'] == 'ALL':
            for metric in METRICS:
                cells = []
                for block in ('development','validation','november_reused'):
                    c = row['metrics'][metric][block]
                    cells.append(f"{c['baseline_hits']} → {c['specialist_hits']} / {c['n']} ({c['specialist_hits']-c['baseline_hits']:+d})")
                lines.append(f"| {row['channel']} | {metric} | " + ' | '.join(cells) + ' |')
    lines += ["", "## Pre-Open Jodi25", "",
              "Jodi25 is the Cartesian product of five predicted Open digits and five predicted Close-before-Open digits: exactly 25 distinct ordered pairs. It is evaluated before observing Open and never uses Close-with-known-Open forecasts. A uniform random actual pair gives this set a 25% chance hit rate. Jodi25 is a separate endpoint; its gain does not establish improvement in every component.", "",
              "Each cell shows production → component Top-5 specialist pair → dedicated early Jodi specialist pair → final weighted pair / events. Dedicated Jodi sources were selected jointly in the early blocks; they differ from independently maximizing each side's Top-5 accuracy.", "",
              "Final Jodi search requires both nonproduction sides to qualify on all five components and improves joint validation hits against production and independent Top-5 specialists. It searches up to 12 qualified candidates per side, plus a production-pair fallback. It does not exhaust arbitrary one-sided reroutes; native source controls remain in the candidate catalogue.", "",
              "| Scope | Early validation | Weight validation | October 16–22 reused | October 23–November 1 reused |", "|---|---|---|---|---|"]
    with np.load(HERE / 'hits.npz', allow_pickle=False) as archive:
        dates, markets = archive['dates'], archive['markets']
        early_jodi = archive['open__weights__top5'][2] & archive['close_pre__weights__top5'][2]
    masks = {'validation': (dates >= '2026-08-17') & (dates <= '2026-09-07'),
             'weight_validation': (dates >= '2026-10-01') & (dates <= '2026-10-15'),
             'late_reused': (dates >= '2026-10-16') & (dates <= '2026-10-22'),
             'november_reused': dates >= '2026-10-23'}
    jodi_ledger = []
    for row in results.get("jodi_summaries", []):
        values = row.get("metrics", {}).get("jodi25", row.get("blocks", {}))
        if values:
            scope = np.ones(len(dates),dtype=bool) if row['market'] == 'ALL' else markets == row['market']
            cells = []
            for block,mask in masks.items():
                counts = values[block]
                early_hits = int(early_jodi[scope & mask].sum())
                cells.append(f"{counts['baseline_hits']} → {counts['specialist_hits']} → {early_hits} → {counts['candidate_hits']} / {counts['n']}")
                jodi_ledger.append({'market':row['market'],'block':block,**counts,'dedicated_jodi_specialist_hits':early_hits,
                                    'fused_net_vs_dedicated_jodi':counts['candidate_hits']-early_hits})
            lines.append(f"| {row['market']} | " + " | ".join(cells) + " |")
    routed_jodi_cells = []
    for block in masks:
        rows = [r for r in jodi_ledger if r['market'] != 'ALL' and r['block'] == block]
        totals = {k:sum(r[k] for r in rows) for k in ('baseline_hits','specialist_hits','dedicated_jodi_specialist_hits','candidate_hits','n')}
        routed_jodi_cells.append(' → '.join(str(totals[k]) for k in ('baseline_hits','specialist_hits','dedicated_jodi_specialist_hits','candidate_hits'))+f" / {totals['n']}")
        jodi_ledger.append({'market':'ROUTED_MARKET_SUM','block':block,**totals,
                            'fused_net_vs_dedicated_jodi':totals['candidate_hits']-totals['dedicated_jodi_specialist_hits']})
    lines.append('| Market-specific pair choices, pooled | ' + ' | '.join(routed_jodi_cells) + ' |')
    with (HERE / 'jodi_summary.csv').open('w',encoding='utf-8',newline='') as handle:
        writer = csv.DictWriter(handle,fieldnames=list(dict.fromkeys(k for row in jodi_ledger for k in row)))
        writer.writeheader()
        writer.writerows(jodi_ledger)
    lines += ["", "## Individual markets", "",
              "| Channel | Market | Endpoint | Weight validation | October 16–22 reused | October 23–November 1 reused |",
              "|---|---|---|---|---|---|"]
    for row in summaries:
        if row["market"] != "ALL":
            for metric in METRICS:
                lines.append(f"| {row['channel']} | {row['market']} | {metric} | " + " | ".join(cell(row['metrics'][metric][b]) for b in BLOCKS[3:]) + " |")
    lines += ablation_report()
    catalogue = read('catalogues.json')
    lines += ['', '## Retained nonproduction fusion settings', '',
              'These settings were selected from fusion-fit blocks, then kept fixed for both reused audit blocks. The individual-market endpoint table above records every gain and regression. Full IDs and parameters remain in `selection.json` and `catalogues.json`.', '',
              '| Channel | Market | Family | Parameters |', '|---|---|---|---|']
    for row in summaries:
        if row['index']:
            meta = catalogue[row['channel']]['weights'][row['index']]
            lines.append(f"| {row['channel']} | {row['market']} | {meta['family']} | `{json.dumps(meta.get('parameters',{}),sort_keys=True)}` |")
    lines += ["", "## Interpretation and reproduction", "",
              "The complete endpoint ledger is `market_summary.csv`. All channels and metrics reuse observations, and pooled rows overlap market rows. Candidate search, repeated historical analysis, upstream fitted-feature selection and short late samples prevent a durable accuracy claim. No candidate is authorized for production by this report.", "",
              "Run `python -B research/combined_prediction_v7/verify_study.py` for the independent audit and `python -B research/combined_prediction_v7/report_study.py` to regenerate these tables without reselection or network access.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"endpoint_rows": len(ledger), "summary_scopes": len(summaries), "fresh_confirmation": False}))


if __name__ == "__main__":
    main()
