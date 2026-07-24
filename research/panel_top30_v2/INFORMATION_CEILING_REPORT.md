# Conditional-information audit

Causal targets: 16,097; candidate conditional models per side: 49.

The direct uniform generalized-Fano calculation places the necessary information scale for 90% Top-30 coverage at approximately **2.14 bits/draw**; a looser conservative form gives **1.59 bits/draw**.

These are necessary scales under a uniform-label assumption, not a proof that no untested causal feature can work. The gains below are out-of-sample estimates for the audited historical feature families.

| Side | Top-30-selected context | Terminal | Forward | Information-selected context | Terminal gain | Forward gain | 90% |
|---|---:|---:|---:|---:|---:|---:|---:|
| open | knn:event_context:200 | 162/974 (16.63%) | 19/78 (24.36%) | table:market_prev123_sutta:5.0 | 0.101 bits | 0.041 bits | no |
| close | table:market_prev123_sutta:5.0 | 193/974 (19.82%) | 13/78 (16.67%) | table:market_prev123_sutta:5.0 | 0.062 bits | 0.004 bits | no |

## open selection leaders

| Model | Parameter | Early Top-30 | Selection Top-30 | Selection log-loss |
|---|---:|---:|---:|---:|
| knn:event_context | 200 | 19.27% | 18.91% | 8.769 bits |
| table:market_weekday | 5.0 | 17.01% | 18.58% | 9.573 bits |
| table:market_weekday | 20.0 | 17.01% | 18.58% | 8.844 bits |
| table:market_weekday | 50.0 | 17.01% | 18.58% | 8.423 bits |
| table:market_month_prev1 | 5.0 | 17.57% | 18.58% | 7.976 bits |
| table:market_month_prev1 | 20.0 | 17.57% | 18.58% | 7.822 bits |
| table:market_month_prev1 | 50.0 | 17.57% | 18.58% | 7.791 bits |
| table:market_weekday_prev1 | 5.0 | 17.57% | 18.46% | 8.176 bits |
| table:market_weekday_prev1 | 20.0 | 17.57% | 18.46% | 7.881 bits |
| table:market_weekday_prev1 | 50.0 | 17.57% | 18.46% | 7.815 bits |
| table:market_prev12_sutta | 5.0 | 18.03% | 18.35% | 7.803 bits |
| table:market_prev12_sutta | 20.0 | 18.03% | 18.35% | 7.784 bits |
| table:market_prev12_sutta | 50.0 | 18.03% | 18.35% | 7.780 bits |
| table:market_last_event_kind | 5.0 | 18.93% | 18.35% | 8.744 bits |
| table:market_last_event_kind | 20.0 | 18.93% | 18.35% | 8.358 bits |

## close selection leaders

| Model | Parameter | Early Top-30 | Selection Top-30 | Selection log-loss |
|---|---:|---:|---:|---:|
| table:market | 5.0 | 20.07% | 22.02% | 7.804 bits |
| table:market | 20.0 | 20.07% | 22.02% | 7.784 bits |
| table:market | 50.0 | 20.07% | 22.02% | 7.771 bits |
| table:market_prev123_sutta | 5.0 | 20.07% | 22.02% | 7.709 bits |
| table:market_prev123_sutta | 20.0 | 20.07% | 22.02% | 7.709 bits |
| table:market_prev123_sutta | 50.0 | 20.07% | 22.02% | 7.709 bits |
| table:market_prev12_sutta | 5.0 | 19.84% | 21.91% | 7.739 bits |
| table:market_prev12_sutta | 20.0 | 19.84% | 21.91% | 7.717 bits |
| table:market_prev12_sutta | 50.0 | 19.84% | 21.91% | 7.712 bits |
| table:market_month_prev1 | 5.0 | 20.18% | 21.91% | 7.928 bits |
| table:market_month_prev1 | 20.0 | 20.18% | 21.91% | 7.766 bits |
| table:market_month_prev1 | 50.0 | 20.18% | 21.91% | 7.730 bits |
| table:market_regime_coarse | 5.0 | 20.63% | 21.80% | 7.887 bits |
| table:market_regime_coarse | 20.0 | 20.63% | 21.80% | 7.757 bits |
| table:market_regime_coarse | 50.0 | 20.63% | 21.80% | 7.728 bits |
