"""Compare rounded-budget baselines with source-matched production exports."""
from __future__ import annotations

import json

import run_study as study


def main() -> None:
    parity=json.loads((study.HERE.parent/'combined_prediction_v6/parity_production.json').read_text())
    for name,expected in parity['productionSourceHashes'].items():
        if study.digest(study.ROOT/name)!=expected:
            raise ValueError(f'Production source changed: {name}; regenerate production parity first')
    replay=study.load_replay()
    lookup={(r['date'],r['market']):i for i,r in enumerate(replay.rows)}
    comparisons=0
    for channel,key in (('open','open'),('close_pre','closePre'),('close_known','closeKnown')):
        values=study.baseline_picks(replay,channel)
        for sample in parity['samples'].values():
            i=lookup[sample['date'],sample['market']]
            for metric,public in (('top5','suttas'),('panel10','panelPicks'),('sp30','spPicks'),('dp20','dpPicks')):
                actual=values[metric][i].tolist()
                expected=sample[key][public]
                if metric=='top5':expected=expected[:5]
                else:actual=[replay.panels[j] for j in actual]
                if actual!=expected:raise ValueError(f'Production baseline mismatch: {channel}/{sample["market"]}/{metric}')
                comparisons+=1
    result={'status':'pass','source_matched_production_lists':comparisons,
            'scope':'Top5 projection of production Sutta ranking and exact panel10/SP30/DP20 budgets across all12markets and3channels.',
            'parity_export_sha256':study.digest(study.HERE.parent/'combined_prediction_v6/parity_production.json')}
    study.save('production_verification.json',result)
    print(json.dumps(result))


if __name__=='__main__':main()
