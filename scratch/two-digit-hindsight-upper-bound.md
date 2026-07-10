# Two-Digit Hindsight Upper Bound

Generated: 2026-07-09T10:19:09.198Z
Average best fixed-pair strict accuracy: 70.1%
Market-sides where hindsight fixed pair reaches >=80%: 0/24

| Market | Side | Best Fixed Avoid Pair | Hindsight Accuracy |
|---|---|---:|---:|
| Sridevi | open | 15 | 76.7% (23/30) |
| Sridevi | close | 48 | 70.0% (21/30) |
| Time Bazar | open | 67 | 73.3% (22/30) |
| Time Bazar | close | 03 | 63.3% (19/30) |
| Madhur Day | open | 47 | 73.3% (22/30) |
| Madhur Day | close | 18 | 73.3% (22/30) |
| Milan Day | open | 25 | 66.7% (20/30) |
| Milan Day | close | 68 | 70.0% (21/30) |
| Rajdhani Day | open | 67 | 70.0% (21/30) |
| Rajdhani Day | close | 46 | 66.7% (20/30) |
| Kalyan | open | 08 | 66.7% (20/30) |
| Kalyan | close | 35 | 73.3% (22/30) |
| Sridevi Night | open | 79 | 70.0% (21/30) |
| Sridevi Night | close | 04 | 70.0% (21/30) |
| Kalyan Night | open | 26 | 73.3% (22/30) |
| Kalyan Night | close | 04 | 70.0% (21/30) |
| Madhur Night | open | 47 | 66.7% (20/30) |
| Madhur Night | close | 28 | 66.7% (20/30) |
| Milan Night | open | 19 | 73.3% (22/30) |
| Milan Night | close | 34 | 70.0% (21/30) |
| Rajdhani Night | open | 37 | 73.3% (22/30) |
| Rajdhani Night | close | 05 | 66.7% (20/30) |
| Main Bazar | open | 19 | 66.7% (20/30) |
| Main Bazar | close | 13 | 73.3% (22/30) |

## Interpretation

- This is not a deployable model. It cheats by choosing the best fixed pair after seeing the latest 30 results.
- If a market-side is below 80% even here, then no fixed-pair avoid strategy could have met the requested target in that window.
- If a market-side is above 80% here, it only proves a pocket existed in hindsight, not that it was predictable before results.