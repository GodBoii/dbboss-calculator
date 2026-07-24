# Absent Digits V3 Deployment

> **Status update (2026-07-25): user-directed production default.** V3 is
> enabled as the app default in version 1.0.20. The original V2 model remains
> available as the automatic route fallback and explicit V2 runtime. The
> observational-evidence limitation below remains unchanged.

Deployed 2026-07-24 as app/PWA version 1.0.17.

## Runtime contract

`absent-digits-guarded-market-routing-v3` retains the complete V2
appearance/direct-absence ensemble and changes only these market-sides:

| Market-side | Candidate feature |
| --- | --- |
| Time Bazar Close | 15-lag panel repetition |
| Milan Day Open | 90-result frequency saturation |
| Milan Day Close | 5-result hot frequency |
| Rajdhani Day Close | 7-lag opposite mapping |
| Kalyan Close | 1-lag jodi transition |
| Kalyan Night Open | Position Markov transition |
| Kalyan Night Close | 90-result frequency saturation |
| Main Bazar Close | 90-result hot frequency |

Every candidate is blended 35% with V2 digit probabilities. It is used only
when its prior 80 comparable predictions have at least two net hits over V2,
the last 40 have non-negative net hits, and at least 60 prior comparisons are
available. Otherwise that market-side returns the V2 pair.

The 120-result Wilson lower-bound safety gate is unchanged. V3 does not turn a
research candidate into a safe call.

## Evidence and limitation

On the inspected historical matrix, the deployed route set scored:

| Window | V2 | V3 | Lift | Paired p |
| --- | ---: | ---: | ---: | ---: |
| Last 180 calendar days | 51.29% | 51.93% | +0.63 pp | .0865 |
| Last 30 calendar days | 50.66% | 50.98% | +0.33 pp | .7905 |

The improvement is not statistically confirmed and the routes were shortlisted
after inspecting historical results. Deployment was therefore user-directed,
with automatic V2 fallback and the original actionability gate retained.
Prospective results must determine whether V3 remains enabled.

## Compatibility

- `buildAbsentDigitsPredictionV3` preserves the V3 research runtime.
- `buildAbsentDigitsPrediction` is the guarded V3 app default.
- `buildAbsentDigitsPredictionV2` preserves the original frozen V2 runtime.
- The V2 forward registry and calibration verifier still reproduce exactly.
- Sutta, jodi, panel, DP, and every other prediction model are unchanged.
- The UI contract is additive: route model and guard state were added without
  removing prior fields.
