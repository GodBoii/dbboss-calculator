# Two-Digit Avoid Rule Miner

Generated: 2026-07-09T07:57:10.483Z

This miner searches high-precision contextual rules for strict 2-digit avoid predictions. A fold is accepted only if mined rules also pass validation.

## Result

- Folds tested: 24
- Accepted folds: 0
- Test predictions after validation gate: 0
- Accepted folds at >=80%: 0

## Latest-Fold Diagnostics

| Market | Side | Rules mined | Validation n | Validation acc | Accepted | Top train rule |
|---|---|---:|---:|---:|---|---|
| Milan Day | close | 12 | 30 | 43.3% | no | pair=15 && digit.sumabs.l14=>=1.8 (83.3%, n=18) |
| Madhur Day | open | 4 | 21 | 66.7% | no | pair.abs.l180=<0.45 && pair.abs.l60=<0.45 (82.1%, n=28) |
| Main Bazar | close | 3 | 0 | 0.0% | no | digit.sumabs.l14=>=1.8 && digit.sumabs.l60=<1.8 (76.0%, n=25) |
| Milan Night | open | 3 | 19 | 52.6% | no | digit.sumabs.l30=<1.35 && prevOpp.pairOverlap=2 (76.8%, n=56) |
| Rajdhani Night | open | 3 | 30 | 56.7% | no | digit.minabs.l120=<0.84 (72.0%, n=25) |
| Madhur Day | close | 2 | 0 | 0.0% | no | digit.minabs.l120=<0.65 (72.2%, n=36) |
| Main Bazar | open | 2 | 0 | 0.0% | no | digit.minabs.l120=<0.65 (75.0%, n=36) |
| Madhur Night | close | 1 | 17 | 35.3% | no | digit.minabs.l120=<0.65 && digit.sumabs.l90=<1.35 (73.9%, n=23) |
| Kalyan | open | 0 | 0 | 0.0% | no | none |
| Kalyan | close | 0 | 0 | 0.0% | no | none |
| Kalyan Night | open | 0 | 0 | 0.0% | no | none |
| Kalyan Night | close | 0 | 0 | 0.0% | no | none |
| Madhur Night | open | 0 | 0 | 0.0% | no | none |
| Milan Day | open | 0 | 0 | 0.0% | no | none |
| Milan Night | close | 0 | 0 | 0.0% | no | none |
| Rajdhani Day | open | 0 | 0 | 0.0% | no | none |
| Rajdhani Day | close | 0 | 0 | 0.0% | no | none |
| Rajdhani Night | close | 0 | 0 | 0.0% | no | none |
| Sridevi | open | 0 | 0 | 0.0% | no | none |
| Sridevi | close | 0 | 0 | 0.0% | no | none |
| Sridevi Night | open | 0 | 0 | 0.0% | no | none |
| Sridevi Night | close | 0 | 0 | 0.0% | no | none |
| Time Bazar | open | 0 | 0 | 0.0% | no | none |
| Time Bazar | close | 0 | 0 | 0.0% | no | none |

## Interpretation

- High-looking train rules exist in a few markets, but they did not survive the validation gate.
- This is evidence of overfitting, not evidence of a deployable 80% strict 2-digit avoid model.
- The next viable path is an even stronger abstention model with fresh holdout tracking, not always-on avoid predictions.
