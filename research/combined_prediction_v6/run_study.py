"""Two-stage, fixed-budget research of joint Sutta/digit/panel predictions."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import sys

for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS'):
    os.environ[key] = '1'
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent/'combined_prediction_v3'))
from study import Replay
import numpy as np
from scipy.stats import binomtest
sys.path.insert(0, str(HERE))
import candidates as models

CHANNELS = ('open', 'close_pre', 'close_known')
METRICS = ('top5', 'avoid2', 'panel10', 'sp30', 'dp20', 'sutta_avoid', 'joint10', 'joint_sp30', 'joint_dp20')


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name: str, value: object) -> None:
    (HERE/name).write_text(json.dumps(value, indent=2, allow_nan=False)+'\n', encoding='utf-8', newline='\n')


def load_replay(extension: bool = False):
    base = Replay()
    rows = list(base.rows)
    for directory, filename, metadata in (
        ('combined_prediction_v3','fresh_replay.jsonl.gz','fresh_replay_metadata.json'),
        ('combined_prediction_v5','fresh_replay.jsonl.gz','fresh_replay_metadata.json'),
        *((('combined_prediction_v6','extension_replay.jsonl.gz','extension_replay_metadata.json'),) if extension else ())):
        folder = HERE.parent/directory
        raw = gzip.decompress((folder/filename).read_bytes())
        if hashlib.sha256(raw).hexdigest() != json.loads((folder/metadata).read_text())['sha256']:
            raise ValueError(f'Replay hash mismatch: {directory}')
        rows.extend(json.loads(line) for line in raw.splitlines())
    return Replay.from_rows(sorted(rows, key=lambda r: (r['date'],r['market'])))


def metric_hits(replay, channel: str, p: np.ndarray) -> dict:
    actual = replay.actual(channel)
    top5 = (replay.sutta_order(p,5) == replay.sutta[actual,None]).any(axis=1)
    pair = np.argmax(p @ replay.pair_absent, axis=1)
    avoid = replay.pair_absent[actual,pair].astype(bool)
    panel = replay.panel_hits(channel,p)
    all_events = np.ones(len(actual),dtype=bool)
    return {'top5':(top5,all_events), 'avoid2':(avoid,all_events),
            'panel10':panel['all10'], 'sp30':panel['sp30'], 'dp20':panel['dp20'],
            'sutta_avoid':(top5 & avoid,all_events),
            'joint10':(top5 & avoid & panel['all10'][0],all_events),
            'joint_sp30':(top5 & avoid & panel['sp30'][0],panel['sp30'][1]),
            'joint_dp20':(top5 & avoid & panel['dp20'][0],panel['dp20'][1])}


def baseline_hits(replay, channel: str) -> dict:
    result = metric_hits(replay,channel,replay.endpoint_probs(channel,'sp30'))
    top5,avoid = result['top5'][0],result['avoid2'][0]
    for name,endpoint in (('panel10','all10'),('sp30','sp30'),('dp20','dp20')):
        hits,eligible = replay.panel_hits(channel,replay.endpoint_probs(channel,endpoint))[endpoint]
        result[name] = hits,eligible
        result[{'panel10':'joint10','sp30':'joint_sp30','dp20':'joint_dp20'}[name]] = top5 & avoid & hits,eligible
    return result


def blocks(replay) -> dict:
    d=replay.dates
    return {'development':d<='2026-08-16', 'validation':(d>='2026-08-17')&(d<='2026-09-07'),
            'refine_train':(d>='2026-09-08')&(d<='2026-09-30'),
            'refine_validation':(d>='2026-10-01')&(d<='2026-10-15'),
            'late_reused':(d>='2026-10-16')&(d<='2026-10-22'), 'extension':d>='2026-10-23'}


def choose(matrices: dict, eligible: dict, objective: str, scope: np.ndarray, train: np.ndarray, validation: np.ndarray) -> int:
    use_train=scope & train & eligible[objective]
    use_val=scope & validation & eligible[objective]
    if use_train.sum()<15 or use_val.sum()<8:
        return 0
    checks = {'sutta_avoid':('top5','avoid2'), 'joint10':('top5','avoid2','panel10'),
              'joint_sp30':('top5','avoid2','sp30'), 'joint_dp20':('top5','avoid2','dp20')}.get(objective,())
    scores=matrices[objective].astype(int)
    delta=scores-scores[0]
    survivors=[0]
    for i in range(1,len(scores)):
        if delta[i,use_train].sum()<0 or delta[i,use_val].sum()<=0:
            continue
        if any((matrices[m][i].astype(int)-matrices[m][0])[scope & b & eligible[m]].sum()<0
               for m in checks for b in (train,validation)):
            continue
        survivors.append(i)
    return min(survivors,key=lambda i:(-int(scores[i,use_val].sum()),i!=0,-int(scores[i,use_train].sum()),i))


def refine_catalogue(shortlist: list[dict]) -> list[dict]:
    parents=sorted({s['candidate'] for s in shortlist if s['candidate']!='production'})
    result=[{'id':'production','family':'baseline'}]
    for parent in parents:
        for fraction in (.25,.5,.75,1.0):
            result.append({'id':f'refine:{parent}:base={fraction}', 'family':'refine_parent',
                           'parents':[parent], 'fractions':[fraction], 'baseline_fraction':1-fraction})
    seen=set()
    for market in sorted({s['market'] for s in shortlist}):
        picks={s['objective']:s['candidate'] for s in shortlist if s['market']==market}
        for left,right in (('top5','avoid2'),('top5','panel10'),('avoid2','panel10'),('sutta_avoid','joint10')):
            pair=tuple(sorted((picks[left],picks[right])))
            if pair[0]==pair[1] or pair in seen:
                continue
            seen.add(pair)
            for weight in (.25,.5,.75):
                result.append({'id':f'cross:{pair[0]}:{pair[1]}:{weight}', 'family':'cross_objective',
                               'parents':list(pair),'fractions':[weight,1-weight],'baseline_fraction':0.0})
    return result


def refined_candidates(replay, channel: str, catalog: list[dict], bank=None):
    needed={p for c in catalog for p in c.get('parents',[]) if p!='production'}
    base=replay.endpoint_probs(channel,'sp30')
    saved={'production':base}
    for metadata,p in models.candidates(replay,channel,bank):
        if metadata['id'] in needed:
            saved[metadata['id']]=p
    for metadata in catalog:
        if metadata['id']=='production':
            yield metadata,base
        else:
            p=metadata['baseline_fraction']*base
            for parent,weight in zip(metadata['parents'],metadata['fractions'],strict=True):
                p=p+weight*saved[parent]
            yield metadata,p/p.sum(axis=1,keepdims=True)


def score_stream(replay,channel: str,stream,base: dict):
    catalog=[]
    hits={m:[] for m in METRICS}
    fingerprints=set()
    for metadata,p in stream:
        if p.shape!=(len(replay.rows),220) or not np.isfinite(p).all() or (p<=0).any():
            raise ValueError(f'Invalid distribution: {metadata}')
        np.testing.assert_allclose(p.sum(axis=1),1,atol=1e-10)
        values=base if metadata['id']=='production' else metric_hits(replay,channel,p)
        catalog.append(metadata)
        fingerprints.add(hashlib.sha256(np.round(p,12).tobytes()).hexdigest())
        for m in METRICS:
            hits[m].append(values[m][0])
    if len({c['id'] for c in catalog})!=len(catalog):
        raise ValueError('Duplicate candidate IDs')
    return catalog,{m:np.array(v) for m,v in hits.items()},len(fingerprints)


def statistics(base,hits,mask,dates) -> dict:
    n=int(mask.sum())
    wins=int((hits & ~base & mask).sum()); losses=int((base & ~hits & mask).sum())
    result={'n':n,'baseline_hits':int(base[mask].sum()),'candidate_hits':int(hits[mask].sum()),
            'wins':wins,'losses':losses,'lift_pp':100*(wins-losses)/n if n else None,
            'paired_p':float(binomtest(wins,wins+losses).pvalue) if wins+losses else 1.0}
    # Cluster whole dates to retain within-day cross-market dependence.
    if n:
        days=np.unique(dates[mask]); delta=hits.astype(int)-base.astype(int)
        totals=np.array([delta[mask & (dates==d)].sum() for d in days])
        sizes=np.array([(mask & (dates==d)).sum() for d in days])
        rng=np.random.default_rng(20261102)
        sampled=rng.integers(0,len(days),size=(2000,len(days)))
        result['day_bootstrap95_pp']=(100*np.quantile(totals[sampled].sum(axis=1)/sizes[sampled].sum(axis=1),[.025,.975])).tolist()
    else:
        result['day_bootstrap95_pp']=None
    return result


def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument('--extension',action='store_true'); args=parser.parse_args()
    if not args.extension and (HERE/'selection_manifest.json').exists():
        raise ValueError('Already frozen; start another study folder for new definitions')
    if args.extension:
        manifest=json.loads((HERE/'selection_manifest.json').read_text())
        for name,expected in manifest['files'].items():
            if digest(HERE/name)!=expected: raise ValueError(f'Frozen file changed: {name}')
    replay=load_replay(args.extension); periods=blocks(replay)
    scopes={'ALL':np.ones(len(replay.rows),dtype=bool),**{m:replay.markets==m for m in sorted(set(replay.markets))}}
    selections=json.loads((HERE/'selection.json').read_text()) if args.extension else []
    catalogues=json.loads((HERE/'catalogues.json').read_text()) if args.extension else {}
    shortlists=json.loads((HERE/'shortlist.json').read_text()) if args.extension else []
    archive={}; summaries=[]
    ledger=HERE/('extension_metrics.csv.gz' if args.extension else 'candidate_metrics.csv.gz')
    with gzip.open(ledger,'wt',encoding='utf-8',newline='') as stream:
        fields=['channel','stage','candidate','family','metric','market','block','n','baseline_hits','candidate_hits','delta_hits']
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader()
        for channel in CHANNELS:
            bank=models.build_bank(replay,channel); base=baseline_hits(replay,channel)
            eligible={m:base[m][1] for m in METRICS}
            if not args.extension:
                baseline_p=replay.endpoint_probs(channel,'sp30')
                candidates=iter([({'id':'production','family':'baseline'},baseline_p)])
                import itertools
                coarse,matrix,distinct=score_stream(replay,channel,itertools.chain(candidates,models.candidates(replay,channel,bank)),base)
                local=[]
                for objective in METRICS:
                    for market,scope in scopes.items():
                        index=choose(matrix,eligible,objective,scope,periods['development'],periods['validation'])
                        local.append({'channel':channel,'objective':objective,'market':market,'candidate':coarse[index]['id'],'index':index})
                shortlists.extend(local)
                refined=refine_catalogue(local)
                catalogues[channel]={'coarse':coarse,'refined':refined,'coarse_distinct_distributions':distinct}
                stage_values=[('coarse',coarse,matrix)]
            else:
                refined=catalogues[channel]['refined'];stage_values=[]
            refined,matrix,distinct=score_stream(replay,channel,refined_candidates(replay,channel,refined,bank),base)
            catalogues[channel]['refined_distinct_distributions']=distinct
            stage_values.append(('refined',refined,matrix))
            for stage,catalog,values in stage_values:
                for m in METRICS:
                    archive[f'{channel}__{stage}__{m}']=values[m]
                    archive[f'{channel}__{stage}__{m}__eligible']=eligible[m]
                    for market,scope in scopes.items():
                        for block,mask in periods.items():
                            if args.extension!=(block=='extension'):continue
                            use=scope & mask & eligible[m]
                            n=int(use.sum()); b=int(values[m][0,use].sum())
                            counts=values[m][:,use].sum(axis=1)
                            writer.writerows({'channel':channel,'stage':stage,'candidate':c['id'],'family':c['family'],
                                              'metric':m,'market':market,'block':block,'n':n,'baseline_hits':b,
                                              'candidate_hits':int(counts[i]),'delta_hits':int(counts[i])-b} for i,c in enumerate(catalog))
            for objective in METRICS:
                for market,scope in scopes.items():
                    if args.extension:
                        entry=next(s for s in selections if (s['channel'],s['objective'],s['market'])==(channel,objective,market))
                        index=entry['index']
                    else:
                        index=choose(matrix,eligible,objective,scope,periods['refine_train'],periods['refine_validation'])
                        entry={'channel':channel,'objective':objective,'market':market,'candidate':refined[index]['id'],'index':index}
                        selections.append(entry)
                    summaries.append({**entry,'metrics':{m:{b:statistics(matrix[m][0],matrix[m][index],scope & mask & eligible[m],replay.dates)
                                                            for b,mask in periods.items() if (b=='extension')==args.extension} for m in METRICS}})
            print(f'Scored {channel}: {len(catalogues[channel]["coarse"])-1} coarse, {len(refined)-1} refined variants',flush=True)
    if not args.extension:
        save('catalogues.json',catalogues);save('shortlist.json',shortlists);save('selection.json',selections)
        files=['run_study.py','candidates.py','protocol.json','catalogues.json','shortlist.json','selection.json']
        hashes={name:digest(HERE/name) for name in files}
        save('selection_manifest.json',{'frozenAtUTC':datetime.now(timezone.utc).isoformat(),'files':hashes,
                                       'selectionSHA256':hashes['selection.json'],'protocolSHA256':hashes['protocol.json']})
    save('extension_results.json' if args.extension else 'results.json',{'rows':len(replay.rows),'markets':sorted(set(replay.markets)),
         'date_range':[str(replay.dates[0]),str(replay.dates[-1])],'selectionSHA256':digest(HERE/'selection.json'),'summaries':summaries})
    np.savez_compressed(HERE/('extension_hits.npz' if args.extension else 'hits.npz'),dates=replay.dates,markets=replay.markets,**archive)


if __name__=='__main__':
    main()
