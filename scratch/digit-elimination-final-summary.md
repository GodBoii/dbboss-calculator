# Digit Elimination Final Research Summary

This is a synthesis of scratch-only research artifacts. No app code was changed.

## Decision Rules

- `Research candidate`: learned beats current by at least 2 pp, beats random by at least 1 pp, and fold W/L is clearly positive.
- `Weak candidate`: learned beats current by at least 1 pp, beats random slightly, and W/L is positive.
- `Keep current`: current already has the better or safer evidence.
- `No strong signal`: neither current nor learned has enough edge over random.
- Fresh Milan Day holdout overrides rolling evidence where learned lost to current.

## Summary Counts

- Research candidates: 2
- Weak candidates: 3
- Keep current: 12
- No strong signal: 19

## Research Candidates

| Market | Side | Random | Current | Learned | Delta vs current | W/L | Folds | Source |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Milan Night | Open | 72.7% | 72.3% | 74.7% | +2.4 pp | 6/2 | 8 | 8-fold pocket |
| Time Bazar | Open | 73.0% | 72.4% | 74.5% | +2.1 pp | 6/2 | 8 | 8-fold pocket |

## Weak Candidates

| Market | Side | Random | Current | Learned | Delta vs current | W/L | Folds | Source |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Time Bazar | Close | 72.7% | 70.7% | 73.2% | +2.5 pp | 6/1 | 8 | 8-fold pocket |
| Main Bazar | Open | 73.0% | 72.4% | 73.8% | +1.4 pp | 5/3 | 8 | 8-fold pocket |
| Sridevi Night | Close | 72.3% | 72.0% | 73.1% | +1.1 pp | 4/3 | 8 | 8-fold pocket |

## Full Market-Side Table

| Market | Side | Random | Current | Learned | Avg current | Avg learned | Delta vs current | W/L | Confidence | Recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Sridevi | Open | 72.7% | 73.8% | 71.5% | 2.95 | 2.86 | -2.3 pp | 0/3 | 35/100 | Keep current |
| Sridevi | Close | 73.1% | 75.4% | 72.3% | 3.02 | 2.89 | -3.1 pp | 1/3 | 35/100 | Keep current |
| Sridevi | Known-open close | 73.1% | 74.2% | 72.3% | 2.97 | 2.89 | -1.9 pp | 1/3 | 35/100 | Keep current |
| Time Bazar | Open | 73.0% | 72.4% | 74.5% | 2.90 | 2.98 | +2.1 pp | 6/2 | 66/100 | Research candidate |
| Time Bazar | Close | 72.7% | 70.7% | 73.2% | 2.83 | 2.93 | +2.5 pp | 6/1 | 68/100 | Weak candidate |
| Time Bazar | Known-open close | 72.7% | 72.9% | 73.2% | 2.92 | 2.93 | +0.3 pp | 5/3 | 20/100 | No strong signal |
| Madhur Day | Open | 73.3% | 76.5% | 74.6% | 3.06 | 2.98 | -1.9 pp | 1/3 | 35/100 | Keep current |
| Madhur Day | Close | 72.3% | 73.8% | 72.3% | 2.95 | 2.89 | -1.5 pp | 2/2 | 35/100 | Keep current |
| Madhur Day | Known-open close | 72.3% | 72.7% | 72.3% | 2.91 | 2.89 | -0.4 pp | 1/2 | 20/100 | No strong signal |
| Milan Day | Open | 72.7% | 72.7% | 72.5% | 2.91 | 2.90 | -0.2 pp | 1/3 | 20/100 | No strong signal |
| Milan Day | Close | 73.0% | 72.7% | 74.4% | 2.91 | 2.98 | +1.7 pp | 6/1 | 20/100 | Keep current - failed fresh holdout |
| Milan Day | Known-open close | 73.0% | 73.4% | 74.4% | 2.94 | 2.98 | +0.9 pp | 6/1 | 20/100 | Keep current - failed fresh holdout |
| Rajdhani Day | Open | 72.7% | 71.5% | 72.5% | 2.86 | 2.90 | +1.0 pp | 2/2 | 20/100 | No strong signal |
| Rajdhani Day | Close | 72.3% | 71.0% | 72.9% | 2.84 | 2.92 | +1.9 pp | 3/1 | 20/100 | No strong signal |
| Rajdhani Day | Known-open close | 72.3% | 71.7% | 72.9% | 2.87 | 2.92 | +1.2 pp | 3/1 | 20/100 | No strong signal |
| Kalyan | Open | 72.2% | 71.9% | 72.1% | 2.88 | 2.88 | +0.2 pp | 2/2 | 20/100 | No strong signal |
| Kalyan | Close | 72.1% | 72.1% | 71.7% | 2.88 | 2.87 | -0.4 pp | 3/3 | 20/100 | No strong signal |
| Kalyan | Known-open close | 72.1% | 70.9% | 71.7% | 2.84 | 2.87 | +0.7 pp | 5/3 | 20/100 | No strong signal |
| Sridevi Night | Open | 73.5% | 74.8% | 72.9% | 2.99 | 2.92 | -1.9 pp | 1/3 | 35/100 | Keep current |
| Sridevi Night | Close | 72.3% | 72.0% | 73.1% | 2.88 | 2.92 | +1.1 pp | 4/3 | 50/100 | Weak candidate |
| Sridevi Night | Known-open close | 72.4% | 73.5% | 74.4% | 2.94 | 2.98 | +0.8 pp | 3/1 | 35/100 | Keep current |
| Kalyan Night | Open | 73.6% | 71.5% | 68.5% | 2.86 | 2.74 | -2.9 pp | 1/3 | 20/100 | No strong signal |
| Kalyan Night | Close | 72.0% | 72.7% | 71.9% | 2.91 | 2.88 | -0.8 pp | 1/2 | 20/100 | No strong signal |
| Kalyan Night | Known-open close | 72.0% | 72.7% | 71.9% | 2.91 | 2.88 | -0.8 pp | 1/3 | 20/100 | No strong signal |
| Madhur Night | Open | 72.5% | 74.8% | 74.0% | 2.99 | 2.96 | -0.8 pp | 3/1 | 35/100 | Keep current |
| Madhur Night | Close | 72.3% | 72.1% | 70.6% | 2.88 | 2.83 | -1.5 pp | 2/2 | 20/100 | No strong signal |
| Madhur Night | Known-open close | 72.3% | 72.5% | 70.6% | 2.90 | 2.83 | -1.9 pp | 0/4 | 20/100 | No strong signal |
| Milan Night | Open | 72.7% | 72.3% | 74.7% | 2.89 | 2.99 | +2.4 pp | 6/2 | 70/100 | Research candidate |
| Milan Night | Close | 71.7% | 70.6% | 70.4% | 2.83 | 2.82 | -0.2 pp | 1/2 | 20/100 | No strong signal |
| Milan Night | Known-open close | 71.7% | 68.3% | 70.4% | 2.73 | 2.82 | +2.1 pp | 2/2 | 20/100 | No strong signal |
| Rajdhani Night | Open | 72.7% | 72.9% | 73.1% | 2.92 | 2.92 | +0.2 pp | 2/2 | 20/100 | No strong signal |
| Rajdhani Night | Close | 72.4% | 74.6% | 73.1% | 2.98 | 2.92 | -1.5 pp | 1/3 | 35/100 | Keep current |
| Rajdhani Night | Known-open close | 72.4% | 72.1% | 73.1% | 2.88 | 2.92 | +1.0 pp | 2/2 | 20/100 | No strong signal |
| Main Bazar | Open | 73.0% | 72.4% | 73.8% | 2.90 | 2.95 | +1.4 pp | 5/3 | 53/100 | Weak candidate |
| Main Bazar | Close | 72.6% | 74.2% | 72.3% | 2.97 | 2.89 | -1.9 pp | 1/3 | 35/100 | Keep current |
| Main Bazar | Known-open close | 72.6% | 72.7% | 72.3% | 2.91 | 2.89 | -0.4 pp | 2/2 | 20/100 | No strong signal |

## Final Recommendation

Do not implement a broad digit-elimination feature yet. The best evidence supports only a few research candidates, and even those sit near 73-75% accuracy, or about 3 correct eliminated digits out of 4. Continue collecting fresh holdout rows before any app integration.
