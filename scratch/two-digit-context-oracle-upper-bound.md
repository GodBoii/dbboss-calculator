# Two-Digit Context Oracle Upper Bound

Generated: 2026-07-09T12:03:57.502Z
Average best context-oracle strict accuracy: 98.5%
Market-sides where context oracle reaches >=80%: 24/24
Average supported-context oracle strict accuracy: 93.9%
Market-sides where supported-context oracle reaches >=80%: 24/24

| Market | Side | Best Context | Strict Accuracy |
|---|---|---|---:|
| Sridevi | open | prev_opp_house_shape, min n=1 | 96.7% (29/30) |
| Sridevi | close | weekday, min n=1 | 100.0% (30/30) |
| Time Bazar | open | prev_sutta, min n=1 | 100.0% (30/30) |
| Time Bazar | close | prev_opp_sutta, min n=1 | 96.7% (29/30) |
| Madhur Day | open | weekday, min n=1 | 100.0% (30/30) |
| Madhur Day | close | prev_opp_sutta, min n=1 | 100.0% (30/30) |
| Milan Day | open | weekday, min n=1 | 100.0% (30/30) |
| Milan Day | close | weekday, min n=1 | 96.7% (29/30) |
| Rajdhani Day | open | prev_opp_sutta, min n=1 | 96.7% (29/30) |
| Rajdhani Day | close | prev_sutta, min n=1 | 100.0% (30/30) |
| Kalyan | open | prev_opp_sutta, min n=1 | 100.0% (30/30) |
| Kalyan | close | weekday, min n=1 | 93.3% (28/30) |
| Sridevi Night | open | weekday, min n=1 | 100.0% (30/30) |
| Sridevi Night | close | prev_sutta, min n=1 | 100.0% (30/30) |
| Kalyan Night | open | prev_opp_sutta, min n=1 | 96.7% (29/30) |
| Kalyan Night | close | prev_sutta, min n=1 | 96.7% (29/30) |
| Madhur Night | open | prev_opp_sutta, min n=1 | 100.0% (30/30) |
| Madhur Night | close | weekday, min n=1 | 96.7% (29/30) |
| Milan Night | open | prev_opp_house_shape, min n=1 | 96.7% (29/30) |
| Milan Night | close | prev_opp_house_shape, min n=1 | 96.7% (29/30) |
| Rajdhani Night | open | prev_sutta, min n=1 | 100.0% (30/30) |
| Rajdhani Night | close | prev_sutta, min n=1 | 100.0% (30/30) |
| Main Bazar | open | prev_sutta, min n=1 | 100.0% (30/30) |
| Main Bazar | close | prev_sutta, min n=1 | 100.0% (30/30) |

## Supported Context Oracle

| Market | Side | Best Supported Context | Strict Accuracy |
|---|---|---|---:|
| Sridevi | open | weekday, min n=4 | 96.7% (29/30) |
| Sridevi | close | weekday, min n=4 | 100.0% (30/30) |
| Time Bazar | open | weekday, min n=4 | 96.7% (29/30) |
| Time Bazar | close | weekday, min n=4 | 93.3% (28/30) |
| Madhur Day | open | weekday, min n=4 | 100.0% (30/30) |
| Madhur Day | close | weekday, min n=4 | 96.7% (29/30) |
| Milan Day | open | weekday, min n=4 | 100.0% (30/30) |
| Milan Day | close | weekday, min n=4 | 96.7% (29/30) |
| Rajdhani Day | open | weekday, min n=4 | 93.3% (28/30) |
| Rajdhani Day | close | weekday, min n=4 | 90.0% (27/30) |
| Kalyan | open | weekday, min n=4 | 96.7% (29/30) |
| Kalyan | close | weekday, min n=4 | 93.3% (28/30) |
| Sridevi Night | open | weekday, min n=4 | 100.0% (30/30) |
| Sridevi Night | close | weekday, min n=4 | 93.3% (28/30) |
| Kalyan Night | open | dom_bucket, min n=4 | 86.7% (26/30) |
| Kalyan Night | close | weekday, min n=4 | 90.0% (27/30) |
| Madhur Night | open | weekday, min n=4 | 93.3% (28/30) |
| Madhur Night | close | weekday, min n=4 | 96.7% (29/30) |
| Milan Night | open | weekday, min n=4 | 93.3% (28/30) |
| Milan Night | close | weekday, min n=4 | 90.0% (27/30) |
| Rajdhani Night | open | dom_mod3, min n=4 | 86.7% (26/30) |
| Rajdhani Night | close | weekday, min n=4 | 90.0% (27/30) |
| Main Bazar | open | weekday, min n=4 | 86.7% (26/30) |
| Main Bazar | close | weekday, min n=4 | 93.3% (28/30) |

## Interpretation

- This oracle is not deployable because it chooses the best pair after seeing the latest 30 results inside each context.
- It estimates whether simple context families had enough structure to support an 80% target in hindsight.
- Strong oracle results still need walk-forward validation; weak oracle results mean that context family is unlikely to support the target.