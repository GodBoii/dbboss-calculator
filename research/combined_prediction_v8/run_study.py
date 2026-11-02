"""Market-specific fixed and causal adaptive model selection. Research only."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

for variable in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):
    os.environ[variable]='1'
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('v8_base',HERE.parent/'combined_prediction_v7/run_study.py')
if spec is None or spec.loader is None:raise ImportError('V7 research runner unavailable')
base=importlib.util.module_from_spec(spec);sys.modules[spec.name]=base;spec.loader.exec_module(base)
sys.path.insert(0,str(HERE))
import numpy as np
from scipy.stats import binomtest
import policies
import static_sources

CHANNELS=base.CHANNELS
METRICS=base.METRICS
BLOCK_NAMES=('weight_train','weight_validation','late_reused','november_reused')


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name: str,value: object) -> None:
    (HERE/name).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8',newline='\n')


def load_replay():
    return base.load_replay()


def blocks(replay) -> dict:
    return {name:mask for name,mask in base.blocks(replay).items() if name in BLOCK_NAMES}


def choose_strict(matrix,eligible,scope,train,val) -> int:
    t=scope & train & eligible;v=scope & val & eligible
    if t.sum()<15 or v.sum()<8:return 0
    allowed=[0]+[i for i in range(1,len(matrix)) if matrix[i,t].sum()>=matrix[0,t].sum() and matrix[i,v].sum()>matrix[0,v].sum()]
    return min(allowed,key=lambda i:(-int(matrix[i,v].sum()),i!=0,-int(matrix[i,t].sum()),i))


def choose_policy(matrix,eligible,scope,train,val) -> tuple[int,str]:
    """Strict local choice when supported; guarded leave-market-out transfer otherwise."""
    t=scope & train & eligible;v=scope & val & eligible
    if t.sum()>=15 and v.sum()>=8:return choose_strict(matrix,eligible,scope,train,val),'local'
    ot=~scope & train & eligible;ov=~scope & val & eligible
    if ot.sum()<30 or ov.sum()<15:return 0,'insufficient_support'
    dt=matrix.astype(np.int16)-matrix[0].astype(np.int16)
    allowed=[0]+[i for i in range(1,len(matrix)) if dt[i,t].sum()>=0 and dt[i,v].sum()>=0
                and dt[i,ot].sum()>=0 and dt[i,ov].sum()>=2]
    # Ten local-equivalent observations from other markets. No target-market leakage.
    return min(allowed,key=lambda i:(-(float(dt[i,v].sum())+10*float(dt[i,ov].mean())),i!=0,
                                     -int(dt[i,t].sum()),i)),'sparse_transfer'


def choose_balanced(matrices,eligible,scope,train,val) -> int:
    if (scope & train).sum()<15 or (scope & val).sum()<8:return 0
    allowed=[0]
    for i in range(1,len(matrices['top5'])):
        if all(matrices[m][i,scope & b & eligible[m]].sum()>=matrices[m][0,scope & b & eligible[m]].sum()
               for m in METRICS for b in (train,val)) and any(matrices[m][i,scope & val & eligible[m]].sum()>matrices[m][0,scope & val & eligible[m]].sum() for m in METRICS):allowed.append(i)
    return min(allowed,key=lambda i:tuple(-int(matrices[m][i,scope & val & eligible[m]].sum()) for m in ('panel10','avoid2','top5','sp30','dp20'))+(i!=0,i))


def counts(reference,current,eligible,scope,periods) -> dict:
    output={}
    for block,mask in periods.items():
        use=scope & mask & eligible;n=int(use.sum())
        wins=int((current & ~reference & use).sum());losses=int((reference & ~current & use).sum())
        output[block]={'n':n,'baseline_hits':int(reference[use].sum()),'candidate_hits':int(current[use].sum()),
                       'wins':wins,'losses':losses,'lift_pp':100*(wins-losses)/n if n else None}
    return output


def annotate_selected(stats,reference,current,eligible,scope,periods,dates) -> None:
    for block,mask in periods.items():
        s=stats[block];use=scope & mask & eligible
        s['paired_p']=float(binomtest(s['wins'],s['wins']+s['losses']).pvalue) if s['wins']+s['losses'] else 1.0
        if not s['n']:s['day_bootstrap95_pp']=None;continue
        days=np.unique(dates[use]);delta=current.astype(int)-reference.astype(int)
        sums=np.array([delta[use & (dates==d)].sum() for d in days]);sizes=np.array([(use & (dates==d)).sum() for d in days])
        draw=np.random.default_rng(20261102).integers(0,len(days),size=(2000,len(days)))
        s['day_bootstrap95_pp']=(100*np.quantile(sums[draw].sum(axis=1)/sizes[draw].sum(axis=1),[.025,.975])).tolist()


def route_all(replay,matrix,eligible,catalog):
    fit_eligible=eligible & (replay.dates>='2026-09-08')
    context=policies.prepare(replay.dates,replay.markets,matrix,fit_eligible)
    routes=np.array([policies.route(replay.dates,replay.markets,matrix,fit_eligible,meta,prepared=context) for meta in catalog],dtype=np.int32)
    if (routes<0).any() or (routes>=len(matrix)).any():raise ValueError('Invalid source route')
    return routes,matrix[routes,np.arange(len(replay.rows))[None,:]]


def main() -> None:
    if (HERE/'selection_manifest.json').exists():raise ValueError('Study frozen; create a new study for changes')
    replay=load_replay();periods=blocks(replay)
    scopes={'ALL':np.ones(len(replay.rows),dtype=bool),**{m:replay.markets==m for m in sorted(set(replay.markets))}}
    old=HERE.parent/'combined_prediction_v7'
    with np.load(old/'hits.npz',allow_pickle=False) as f:previous={k:f[k] for k in f.files}
    old_catalog=json.loads((old/'catalogues.json').read_text());old_selection=json.loads((old/'selection.json').read_text())
    if not np.array_equal(previous['dates'],replay.dates) or not np.array_equal(previous['markets'],replay.markets):raise ValueError('V7 row order changed')
    control_catalog=policies.catalogue()
    static_catalog=[{'id':'static/v7_local_specialists','family':'static_reference','description':'V7 endpoint specialists fixed after Sep7'},
                    {'id':'static/v7_local_weights','family':'static_reference','description':'V7 market weight selections, available only after Oct15'},
                    {'id':'static/new_local_mixture','family':'static_reference','description':'Fixed equal local specialist probability mixture'}]
    policy_catalog=control_catalog+static_catalog
    archive={'dates':replay.dates,'markets':replay.markets};source_catalogues={};summaries=[];balanced_summaries=[];selections=[]
    with gzip.open(HERE/'approach_metrics.csv.gz','wt',encoding='utf-8',newline='') as handle:
        writer=csv.writer(handle);writer.writerow(['channel','metric','market','approach','block','n','baseline_hits','candidate_hits','wins','losses','lift_pp'])
        def endpoint(ch,metric,matrix,eligible,source_catalog,static_routes=None):
            routes,method_hits=route_all(replay,matrix,eligible,control_catalog)
            if static_routes is not None:
                routes=np.vstack((routes,static_routes));method_hits=matrix[routes,np.arange(len(replay.rows))[None,:]]
                methods=policy_catalog
            else:methods=control_catalog
            archive[f'{ch}__{metric}']=matrix;archive[f'{ch}__{metric}__eligible']=eligible
            archive[f'{ch}__{metric}__routes']=routes;archive[f'{ch}__{metric}__policy_hits']=method_hits
            for market,scope in scopes.items():
                index,mode=choose_policy(method_hits,eligible,scope,periods['weight_train'],periods['weight_validation'])
                strict=choose_strict(method_hits,eligible,scope,periods['weight_train'],periods['weight_validation'])
                approaches={meta['id']:counts(matrix[0],method_hits[i],eligible,scope,periods) for i,meta in enumerate(methods)}
                selected=methods[index]['id'];annotate_selected(approaches[selected],matrix[0],method_hits[index],eligible,scope,periods,replay.dates)
                row={'channel':ch,'metric':metric,'market':market,'selected':selected,'index':index,
                     'strict_local_index':strict,'selection_mode':mode,'approaches':approaches}
                summaries.append(row);selections.append({k:row[k] for k in ('channel','metric','market','selected','index','strict_local_index','selection_mode')})
                for approach,blocks_ in approaches.items():
                    for block,s in blocks_.items():writer.writerow([ch,metric,market,approach,block,*[s[k] for k in ('n','baseline_hits','candidate_hits','wins','losses','lift_pp')]])
            return routes,method_hits
        for ch in CHANNELS:
            catalog=[{'id':'production','family':'baseline','origin':'expert','source_index':0}]
            catalog.extend({**c,'id':'expert/'+c['id'],'origin':'expert','source_index':i} for i,c in enumerate(old_catalog[ch]['experts']) if i)
            catalog.extend({**c,'id':'weight/'+c['id'],'origin':'weights','source_index':i} for i,c in enumerate(old_catalog[ch]['weights']) if i)
            initial_count=len(catalog)
            arrays={m:[previous[f'{ch}__expert__{m}'],previous[f'{ch}__weights__{m}'][1:]] for m in METRICS}
            bank=static_sources.load_bundles(replay,ch)
            for metadata,p in static_sources.candidates(replay,ch,bank):
                out=base.hits(replay,ch,base.picks(replay,p));catalog.append({**metadata,'id':'blend/'+metadata['id'],'origin':'blend','source_index':len(catalog)-initial_count})
                for m in METRICS:arrays[m].append(out[m][None,:])
            source_catalogues[ch]=catalog
            matrices={m:np.concatenate(arrays[m]) for m in METRICS};eligible=base.eligibility(replay,ch)
            if any(len(matrix)!=len(catalog) for matrix in matrices.values()):raise ValueError('Source catalogue length mismatch')
            indices=np.arange(len(replay.rows));specialists=np.full(len(indices),len(old_catalog[ch]['experts']),dtype=np.int32)
            v7_local=np.zeros(len(indices),dtype=np.int32)
            for entry in old_selection:
                if entry['channel']!=ch or entry['market']=='ALL' or not entry['index']:continue
                mask=(replay.markets==entry['market']) & (replay.dates>='2026-10-16')
                v7_local[mask]=len(old_catalog[ch]['experts'])-1+entry['index']
            # Fixed equal local mixture is a known declared blend, selected without audit outcomes.
            local_indices=[i for i,c in enumerate(catalog) if c['origin']=='blend' and c['family']=='static_arithmetic'
                           and c['parameters'].get('profile')=='equal' and c['parameters'].get('local_fraction')==1.0]
            if not local_indices:
                local_indices=[i for i,c in enumerate(catalog) if c['origin']=='blend' and c.get('parameters',{}).get('control')=='local/panel10']
            local_fixed=np.full(len(indices),local_indices[0] if local_indices else 0,dtype=np.int32)
            fixed=np.array([specialists,v7_local,local_fixed])
            for m in METRICS:
                endpoint(ch,m,matrices[m],eligible[m],catalog,fixed)
                print(f'Routed {ch}/{m}: {len(catalog)} source models, {len(policy_catalog)} approaches',flush=True)
            # Coherent model routing uses one source index for all five outputs per draw.
            # This is an explicit utility for choosing models, never an overall accuracy rate.
            utility=sum(matrices[m].astype(float) for m in METRICS)/5
            for i,c in enumerate(catalog):
                if c['origin']=='weights' and c['source_index'] in (1,2):utility[i]=utility[0]
            coherent_routes,_=route_all(replay,utility,np.ones(len(indices),dtype=bool),control_catalog)
            archive[f'{ch}__balanced__routes']=coherent_routes
            balanced={m:matrices[m][coherent_routes,indices[None,:]] for m in METRICS}
            for m in METRICS:archive[f'{ch}__balanced__{m}']=balanced[m]
            for market,scope in scopes.items():
                i=choose_balanced(balanced,eligible,scope,periods['weight_train'],periods['weight_validation'])
                row={'channel':ch,'market':market,'index':i,'selected':control_catalog[i]['id'],
                     'metrics':{m:counts(matrices[m][0],balanced[m][i],eligible[m],scope,periods) for m in METRICS}}
                for m in METRICS:annotate_selected(row['metrics'][m],matrices[m][0],balanced[m][i],eligible[m],scope,periods,replay.dates)
                balanced_summaries.append(row)
        # Preopen Jodi candidates: same source scheme plus cross-controller Top5 strategies.
        open_source=archive['open__top5'];close_source=archive['close_pre__top5']
        if [c['id'] for c in source_catalogues['open']]!=[c['id'] for c in source_catalogues['close_pre']]:raise ValueError('Source schemes differ across Jodi channels')
        jodi_sources=[{'id':'same_source/'+c['id'],'family':'same_source','open_source':i,'close_source':i} for i,c in enumerate(source_catalogues['open'])]
        joint=[open_source & close_source]
        archetypes=[]
        for family in ('baseline','local_calendar','local_draws','shrinkage','decay','empirical_bernstein','counter_regression'):
            archetypes.append(next(i for i,c in enumerate(control_catalog) if c['family']==family))
        for a in archetypes:
            for b in archetypes:
                jodi_sources.append({'id':f'controller_cross/open={a}/close={b}','family':'controller_cross','open_policy':a,'close_policy':b})
                joint.append((archive['open__top5__policy_hits'][a]&archive['close_pre__top5__policy_hits'][b])[None,:])
        jodi_matrix=np.concatenate(joint);source_catalogues['jodi_pre']=jodi_sources
        endpoint('jodi_pre','jodi25',jodi_matrix,np.ones(len(replay.rows),dtype=bool),jodi_sources)
        print(f'Routed Jodi25: {len(jodi_sources)} source schemes',flush=True)
    save('catalogues.json',{'sources':source_catalogues,'policies':policy_catalog,'controllers':control_catalog})
    save('selection.json',selections);save('balanced_selection.json',[{k:r[k] for k in ('channel','market','index','selected')} for r in balanced_summaries])
    save('results.json',{'rows':len(replay.rows),'markets':sorted(set(replay.markets)),
                          'date_range':[str(replay.dates[0]),str(replay.dates[-1])],'summaries':summaries,'balanced_summaries':balanced_summaries,'all_dates_reused':True})
    np.savez_compressed(HERE/'hits.npz',**archive)
    files=['run_study.py','policies.py','static_sources.py','protocol.json','catalogues.json','selection.json','balanced_selection.json']
    save('selection_manifest.json',{'frozenAtUTC':datetime.now(timezone.utc).isoformat(),'files':{name:digest(HERE/name) for name in files},'all_dates_reused':True})
    save('prospective_protocol.json',{'createdAtUTC':datetime.now(timezone.utc).isoformat(),
          'status':'Frozen policy definitions only. No future predictions or outcomes collected; no automation scheduled.',
          'market_endpoint_policy_sha256':digest(HERE/'selection.json'),'balanced_policy_sha256':digest(HERE/'balanced_selection.json'),
          'evaluation':'Before any prospective claim, register timestamped predictions and score at least60complete futuremarket draws at unchanged budgets. Report eachmetric separately and allrequired-output regressions.'})


if __name__=='__main__':main()
