# Top-60 market-specific routing audit

Generated: 2026-07-24T01:01:30.059344+05:30

Routes were selected on the terminal cache block and evaluated once on the newer post-cache forward rows. The forward block did not choose a route.

| Task | Forward N | Global baseline | Routed | Profile | Routed vs baseline p |
|---|---:|---:|---:|---:|---:|
| open | 150 | 39.3% | 39.3% | 38.7% | 1.0000 |
| close_preopen | 150 | 36.7% | 38.0% | 41.3% | 0.8642 |

## open routes

| Market | Selected route | Terminal baseline | Terminal routed | Forward baseline | Forward routed |
|---|---|---:|---:|---:|---:|
| Sridevi | dynamic_wd1 | 37.5% | 41.7% | 57.1% | 50.0% |
| Time Bazar | lowrank_d25 | 28.0% | 43.9% | 25.0% | 33.3% |
| Madhur Day | dynamic_wd1 | 32.3% | 35.4% | 28.6% | 50.0% |
| Milan Day | lowrank_d50 | 32.9% | 39.5% | 44.4% | 27.8% |
| Rajdhani Day | lowrank_d25 | 30.5% | 39.0% | 41.7% | 33.3% |
| Kalyan | ensemble:profile+hot | 34.1% | 45.1% | 58.3% | 33.3% |
| Sridevi Night | lowrank_top60 | 33.3% | 35.4% | 35.7% | 35.7% |
| Kalyan Night | dynamic_wd01 | 43.1% | 43.1% | 50.0% | 50.0% |
| Madhur Night | lowrank_d50 | 36.6% | 50.0% | 58.3% | 41.7% |
| Milan Night | dynamic_wd1 | 36.6% | 41.5% | 16.7% | 41.7% |
| Rajdhani Night | dynamic_wd01 | 44.1% | 44.1% | 30.0% | 30.0% |
| Main Bazar | lowrank_d25 | 29.9% | 38.8% | 20.0% | 50.0% |

## close_preopen routes

| Market | Selected route | Terminal baseline | Terminal routed | Forward baseline | Forward routed |
|---|---|---:|---:|---:|---:|
| Sridevi | dynamic_wd01 | 40.6% | 40.6% | 50.0% | 50.0% |
| Time Bazar | ensemble:global+profile | 37.8% | 46.3% | 50.0% | 41.7% |
| Madhur Day | ensemble:profile+hot | 25.0% | 42.7% | 7.1% | 35.7% |
| Milan Day | lowrank_d50 | 34.2% | 43.4% | 27.8% | 27.8% |
| Rajdhani Day | dynamic_wd01 | 48.8% | 48.8% | 25.0% | 25.0% |
| Kalyan | ensemble:profile+hot | 46.3% | 50.0% | 58.3% | 66.7% |
| Sridevi Night | dynamic_wd1 | 44.8% | 49.0% | 35.7% | 50.0% |
| Kalyan Night | lowrank_d50 | 46.2% | 50.8% | 50.0% | 40.0% |
| Madhur Night | lowrank_top60 | 34.1% | 42.7% | 58.3% | 33.3% |
| Milan Night | ensemble:global+profile | 50.0% | 56.1% | 33.3% | 33.3% |
| Rajdhani Night | lowrank_d50 | 36.8% | 42.6% | 40.0% | 20.0% |
| Main Bazar | ensemble:global+profile+hot | 35.8% | 41.8% | 10.0% | 30.0% |

## Decision rule

A market leaves the global model only when another candidate adds at least two terminal hits, wins at least two calendar months, and has at least as many winning as losing months. All other markets fall back to the global model. Forward results decide whether routing is credible; terminal improvements are selection results, not evidence of deployment accuracy.
