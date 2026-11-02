"""Independent component specialists, Jodi25 specialists, then guarded fusion."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import sys

for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):
    os.environ[name]='1'
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE.parent/'combined_prediction_v3'))
from study import Replay
import numpy as np
from scipy.stats import binomtest
sys.path.insert(0,str(HERE))
import experts
import weights

CHANNELS=('open','close_pre','close_known')
METRICS=('top5','avoid2','panel10','sp30','dp20')
PAIRS=np.array([(a,b) for a in range(10) for b in range(a+1,10)])


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name: str,value: object) -> None:
    (HERE/name).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8',newline='\n')


def load_replay():
    replay=Replay(); rows=list(replay.rows)
    for directory,stem in (('combined_prediction_v3','fresh'),('combined_prediction_v5','fresh'),('combined_prediction_v6','extension')):
        folder=HERE.parent/directory
        raw=gzip.decompress((folder/f'{stem}_replay.jsonl.gz').read_bytes())
        metadata=json.loads((folder/f'{stem}_replay_metadata.json').read_text())
        if hashlib.sha256(raw).hexdigest()!=metadata['sha256']:raise ValueError(f'Invalid {directory} replay')
        rows.extend(json.loads(line) for line in raw.splitlines())
    return Replay.from_rows(sorted(rows,key=lambda r:(r['date'],r['market'])))


def picks(replay,p: np.ndarray) -> dict:
    if p.shape!=(len(replay.rows),220) or not np.isfinite(p).all() or (p<=0).any():raise ValueError('Invalid distribution')
    np.testing.assert_allclose(p.sum(axis=1),1,atol=1e-10)
    # Explicit bucket sums and rounded ranking scores eliminate accidental last-bit tie wins.
    sutta=np.stack([p[:,replay.sutta==s].sum(axis=1) for s in range(10)],axis=1)
    absent=np.stack([p[:,replay.pair_absent[:,i].astype(bool)].sum(axis=1) for i in range(45)],axis=1)
    result={'top5':np.argsort(-np.round(sutta,12),axis=1,kind='stable')[:,:5],
            'avoid2':PAIRS[np.argmax(np.round(absent,12),axis=1)]}
    for name,kind,count in (('panel10',None,10),('sp30','SP',30),('dp20','DP',20)):
        allowed=np.arange(220) if kind is None else np.flatnonzero(replay.kind==kind)
        result[name]=allowed[np.argsort(-np.round(p[:,allowed],12),axis=1,kind='stable')[:,:count]]
    return result


def eligibility(replay,ch: str) -> dict:
    kind=replay.kind[replay.actual(ch)]
    return {m:(kind=='SP' if m=='sp30' else kind=='DP' if m=='dp20' else np.ones(len(kind),dtype=bool)) for m in METRICS}


def hits(replay,ch: str,outputs: dict) -> dict:
    actual=replay.actual(ch)
    return {'top5':(outputs['top5']==replay.sutta[actual,None]).any(axis=1),
            'avoid2':np.array([all(str(d) not in replay.panels[a] for d in pair) for a,pair in zip(actual,outputs['avoid2'],strict=True)]),
            **{m:(outputs[m]==actual[:,None]).any(axis=1) for m in ('panel10','sp30','dp20')}}


def baseline_picks(replay,ch: str) -> dict:
    p=picks(replay,replay.endpoint_probs(ch,'sp30'))
    p['panel10']=picks(replay,replay.endpoint_probs(ch,'all10'))['panel10']
    p['dp20']=picks(replay,replay.endpoint_probs(ch,'dp20'))['dp20']
    return p


def blocks(replay) -> dict:
    d=replay.dates
    return {'development':d<='2026-08-16','validation':(d>='2026-08-17')&(d<='2026-09-07'),
            'weight_train':(d>='2026-09-08')&(d<='2026-09-30'),
            'weight_validation':(d>='2026-10-01')&(d<='2026-10-15'),
            'late_reused':(d>='2026-10-16')&(d<='2026-10-22'),
            'november_reused':d>='2026-10-23'}


def choose_component(matrix,eligible,scope,train,val) -> int:
    t=scope & train & eligible; v=scope & val & eligible
    if t.sum()<15 or v.sum()<8:return 0
    candidates=[0]+[i for i in range(1,len(matrix)) if matrix[i,t].sum()>=matrix[0,t].sum() and matrix[i,v].sum()>matrix[0,v].sum()]
    return min(candidates,key=lambda i:(-int(matrix[i,v].sum()),i!=0,-int(matrix[i,t].sum()),i))


def qualified(matrices,eligible,scope,train,val,index: int) -> bool:
    for m in METRICS:
        for block in (train,val):
            use=scope & block & eligible[m]
            if matrices[m][index,use].sum()<max(matrices[m][0,use].sum(),matrices[m][1,use].sum()):return False
    return True


def choose_balanced(matrices,eligible,scope,train,val) -> int:
    if (scope & train).sum()<15 or (scope & val).sum()<8:return 0
    valid=[i for i in range(1,len(matrices['top5'])) if qualified(matrices,eligible,scope,train,val,i)
           and any(matrices[m][i,scope & val & eligible[m]].sum()>max(matrices[m][0,scope & val & eligible[m]].sum(),matrices[m][1,scope & val & eligible[m]].sum()) for m in METRICS)]
    if not valid:return 0
    # No averaging conditional rates: fixed, declared lexicographic objective.
    return min(valid,key=lambda i:tuple(-int(matrices[m][i,scope & val & eligible[m]].sum()) for m in ('panel10','avoid2','top5','sp30','dp20'))+(i,))


def jodi_pair(open_matrix,close_matrix,open_ids,close_ids,scope,train,val) -> tuple[int,int]:
    t=scope & train; v=scope & val
    if t.sum()<15 or v.sum()<8:return 0,0
    base=open_matrix[0] & close_matrix[0]
    choices=[(0,0)]
    for a in open_ids:
        for b in close_ids:
            current=open_matrix[a] & close_matrix[b]
            if current[t].sum()>=base[t].sum() and current[v].sum()>base[v].sum():choices.append((a,b))
    return min(choices,key=lambda pair:(-int((open_matrix[pair[0]] & close_matrix[pair[1]])[v].sum()),pair!=(0,0),
                                        -int((open_matrix[pair[0]] & close_matrix[pair[1]])[t].sum()),pair))


def stats(base,specialist,current,eligible,scope,periods,dates) -> dict:
    result={}
    for block,mask in periods.items():
        use=scope & mask & eligible; n=int(use.sum())
        wins=int((current & ~base & use).sum()); losses=int((base & ~current & use).sum())
        output={'n':n,'baseline_hits':int(base[use].sum()),'specialist_hits':int(specialist[use].sum()),'candidate_hits':int(current[use].sum()),
                'lift_pp':100*(wins-losses)/n if n else None,'wins':wins,'losses':losses,
                'paired_p':float(binomtest(wins,wins+losses).pvalue) if wins+losses else 1.0}
        if n:
            days=np.unique(dates[use]); sums=np.array([(current.astype(int)-base.astype(int))[use & (dates==d)].sum() for d in days]); sizes=np.array([(use & (dates==d)).sum() for d in days])
            draw=np.random.default_rng(20261102).integers(0,len(days),size=(2000,len(days)))
            output['day_bootstrap95_pp']=(100*np.quantile(sums[draw].sum(axis=1)/sizes[draw].sum(axis=1),[.025,.975])).tolist()
        result[block]=output
    return result


def main() -> None:
    if (HERE/'selection_manifest.json').exists():raise ValueError('Study already frozen; do not overwrite')
    replay=load_replay(); periods=blocks(replay)
    scopes={'ALL':np.ones(len(replay.rows),dtype=bool),**{m:replay.markets==m for m in sorted(set(replay.markets))}}
    archive={'dates':replay.dates,'markets':replay.markets}; catalogues={}; component_selection=[]; bundles={}; expert_matrices={}; bank_by_channel={}
    with gzip.open(HERE/'candidate_metrics.csv.gz','wt',encoding='utf-8',newline='') as handle:
        writer=csv.writer(handle);writer.writerow(['channel','stage','candidate','family','metric','market','block','n','baseline_hits','specialist_hits','candidate_hits'])
        def ledger(ch,stage,catalog,matrix,eligible):
            for m in METRICS:
                archive[f'{ch}__{stage}__{m}']=matrix[m]
                archive[f'{ch}__{stage}__{m}__eligible']=eligible[m]
                for market,scope in scopes.items():
                    for block,mask in periods.items():
                        use=scope & mask & eligible[m]; totals=matrix[m][:,use].sum(axis=1)
                        writer.writerows([ch,stage,c['id'],c['family'],m,market,block,int(use.sum()),int(totals[0]),int(totals[1]) if stage=='weights' else '',int(totals[i])] for i,c in enumerate(catalog))
        # Phase 1: fit each component independently, never using fusion-fit or audit dates.
        for ch in CHANNELS:
            bank=experts.build_bank(replay,ch);bank_by_channel[ch]=bank
            native=baseline_picks(replay,ch);base=hits(replay,ch,native);eligible=eligibility(replay,ch)
            catalog=[{'id':'production','family':'baseline'}]; arrays={m:[base[m]] for m in METRICS}
            for metadata,p in experts.candidates(replay,ch,bank):
                values=hits(replay,ch,picks(replay,p));catalog.append(metadata)
                for m in METRICS:arrays[m].append(values[m])
            matrix={m:np.array(v) for m,v in arrays.items()};expert_matrices[ch]=matrix
            for m in METRICS:
                for market,scope in scopes.items():
                    i=choose_component(matrix[m],eligible[m],scope,periods['development'],periods['validation'])
                    component_selection.append({'channel':ch,'metric':m,'market':market,'index':i,'candidate':catalog[i]['id']})
            catalogues[ch]={'experts':catalog}
            ledger(ch,'expert',catalog,matrix,eligible)
            print(f'Scored specialists {ch}: {len(catalog)-1} experts',flush=True)
        # Separate early Jodi optimization with non-regressing marginal Sutta candidates.
        jodi_specialists=[]
        for market,scope in scopes.items():
            ids={}
            for ch in ('open','close_pre'):
                h=expert_matrices[ch]['top5'];t=scope & periods['development'];v=scope & periods['validation']
                valid=[i for i in range(1,len(h)) if h[i,t].sum()>=h[0,t].sum() and h[i,v].sum()>=h[0,v].sum()]
                ids[ch]=[0]+sorted(valid,key=lambda i:(-int(h[i,v].sum()),-int(h[i,t].sum()),i))[:8]
            a,b=jodi_pair(expert_matrices['open']['top5'],expert_matrices['close_pre']['top5'],ids['open'],ids['close_pre'],scope,periods['development'],periods['validation'])
            jodi_specialists.append({'market':market,'open_index':a,'close_index':b,
                                     'open_candidate':catalogues['open']['experts'][a]['id'],'close_candidate':catalogues['close_pre']['experts'][b]['id']})
        save('component_selection.json',component_selection);save('jodi_specialist_selection.json',jodi_specialists)
        save('component_freeze.json',{'frozenAtUTC':datetime.now(timezone.utc).isoformat(),'componentSHA256':digest(HERE/'component_selection.json'),
                                      'jodiSHA256':digest(HERE/'jodi_specialist_selection.json'),'all_data_retrospective':True})
        # Reconstruct only selected specialist probabilities into per-market bundles.
        for ch in CHANNELS:
            bundle={m:replay.endpoint_probs(ch,{'panel10':'all10','dp20':'dp20'}.get(m,'sp30')).copy() for m in METRICS}
            bundle['baseline']=replay.endpoint_probs(ch,'sp30');bundle['jodi']=bundle['top5'].copy()
            assignment={}
            for item in component_selection:
                if item['channel']==ch and item['market']!='ALL' and item['index']:
                    assignment.setdefault(item['candidate'],[]).append((item['metric'],scopes[item['market']]))
            for item in jodi_specialists:
                if item['market']=='ALL' or ch=='close_known':continue
                cid=item['open_candidate'] if ch=='open' else item['close_candidate']
                if cid!='production':assignment.setdefault(cid,[]).append(('jodi',scopes[item['market']]))
            for metadata,p in experts.candidates(replay,ch,bank_by_channel[ch]):
                for metric,mask in assignment.get(metadata['id'],[]):bundle[metric][mask]=p[mask]
            if ch=='close_known':bundle['jodi']=bundle['top5'].copy()
            bundles[ch]=bundle
        # Phase 2: fuse frozen specialists, preserving separate exact output baselines.
        weight_matrices={}; summaries=[]; selection=[]
        for ch in CHANNELS:
            bundle=bundles[ch];base=hits(replay,ch,baseline_picks(replay,ch));eligible=eligibility(replay,ch)
            specialist_outputs={m:picks(replay,bundle[m])[m] for m in METRICS}
            specialist=hits(replay,ch,specialist_outputs)
            jodi_outputs={**specialist_outputs,'top5':picks(replay,bundle['jodi'])['top5']}
            jodi_values=hits(replay,ch,jodi_outputs)
            catalog=[{'id':'production','family':'baseline'},{'id':'independent_specialists','family':'specialist_bundle'},{'id':'jodi_specialists','family':'specialist_bundle'}]
            arrays={m:[base[m],specialist[m],jodi_values[m]] for m in METRICS}
            for metadata,p in weights.candidates(replay,ch,bundle):
                values=hits(replay,ch,picks(replay,p));catalog.append(metadata)
                for m in METRICS:arrays[m].append(values[m])
            matrix={m:np.array(v) for m,v in arrays.items()};weight_matrices[ch]=matrix;catalogues[ch]['weights']=catalog
            ledger(ch,'weights',catalog,matrix,eligible)
            for market,scope in scopes.items():
                i=choose_balanced(matrix,eligible,scope,periods['weight_train'],periods['weight_validation'])
                entry={'channel':ch,'market':market,'index':i,'candidate':catalog[i]['id'],'kind':'balanced'};selection.append(entry)
                summaries.append({**entry,'metrics':{m:stats(matrix[m][0],matrix[m][1],matrix[m][i],eligible[m],scope,periods,replay.dates) for m in METRICS}})
            print(f'Scored fusion {ch}: {len(catalog)-3} weight variants',flush=True)
        # Jodi25 weight-pair search. Both sides must preserve every component on fit blocks.
        jodi_selection=[];jodi_summaries=[]
        oh=weight_matrices['open']['top5'];ch=weight_matrices['close_pre']['top5'];base=oh[0]&ch[0];specialist=oh[1]&ch[1]
        archive['jodi_baseline']=base;archive['jodi_specialists']=specialist
        for market,scope in scopes.items():
            choices={}
            for channel in ('open','close_pre'):
                matrix=weight_matrices[channel];eligible=eligibility(replay,channel);v=scope & periods['weight_validation']
                valid=[i for i in range(1,len(matrix['top5'])) if qualified(matrix,eligible,scope,periods['weight_train'],periods['weight_validation'],i)]
                choices[channel]=[0]+sorted(valid,key=lambda i:(-int(matrix['top5'][i,v].sum()),i))[:12]
            t=scope & periods['weight_train'];v=scope & periods['weight_validation'];pairs=[(0,0)]
            if t.sum()>=15 and v.sum()>=8:
                for a in choices['open']:
                    for b in choices['close_pre']:
                        if a==0 or b==0:continue
                        h=oh[a]&ch[b]
                        if h[t].sum()>=max(base[t].sum(),specialist[t].sum()) and h[v].sum()>max(base[v].sum(),specialist[v].sum()):pairs.append((a,b))
            a,b=min(pairs,key=lambda pair:(-int((oh[pair[0]]&ch[pair[1]])[v].sum()),pair!=(0,0),-int((oh[pair[0]]&ch[pair[1]])[t].sum()),pair))
            entry={'market':market,'open_index':a,'close_index':b,'open_candidate':catalogues['open']['weights'][a]['id'],'close_candidate':catalogues['close_pre']['weights'][b]['id']}
            jodi_selection.append(entry)
            jodi_summaries.append({**entry,'blocks':stats(base,specialist,oh[a]&ch[b],np.ones(len(base),dtype=bool),scope,periods,replay.dates)})
    save('catalogues.json',catalogues);save('selection.json',selection);save('jodi_selection.json',jodi_selection)
    save('results.json',{'rows':len(replay.rows),'markets':sorted(set(replay.markets)),'date_range':[str(replay.dates[0]),str(replay.dates[-1])],
                         'summaries':summaries,'jodi_summaries':jodi_summaries,'all_dates_reused':True})
    np.savez_compressed(HERE/'hits.npz',**archive)
    np.savez_compressed(HERE/'specialist_probabilities.npz',**{f'{ch}__{m}':p for ch,b in bundles.items() for m,p in b.items()})
    files=['run_study.py','experts.py','weights.py','protocol.json','component_selection.json','jodi_specialist_selection.json',
           'component_freeze.json','catalogues.json','selection.json','jodi_selection.json']
    save('selection_manifest.json',{'frozenAtUTC':datetime.now(timezone.utc).isoformat(),'files':{f:digest(HERE/f) for f in files},'all_data_retrospective':True})


if __name__=='__main__':main()
