# Complementary Absent-Digits Research V2

Generated: 2026-07-24T11:43:11.387676+00:00

## Decision

No market-side clears the frozen 80% Wilson-lower-bound gate. The engine therefore produces research candidates but abstains from every actionable avoid call.

Validation selected appearance-family weight `0.75`; the remaining weight is assigned to the direct absence family.

## Chronological results

| Block | N | Ensemble strict | Appearance only | Absence only | Random reference | Avg absent digits | Macro | Worst market-side | Agreement |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | 2348 | 52.1% (1224/2348) | 51.7% | 51.3% | 50.5% | 1.471/2 | 52.2% | 39.7% | 54.9% |
| Holdout | 2466 | 50.5% (1246/2466) | 50.5% | 51.1% | 50.6% | 1.454/2 | 50.5% | 41.7% | 56.2% |
| Recent | 2300 | 51.9% (1193/2300) | 51.7% | 50.7% | 50.8% | 1.471/2 | 51.8% | 45.3% | 53.0% |
| Post Cache | 288 | 45.8% (132/288) | 48.6% | 48.3% | 50.0% | 1.389/2 | 45.8% | 8.3% | 47.6% |
| Independent Extension | 88 | 60.2% (53/88) | 59.1% | 63.6% | 52.3% | 1.568/2 | 60.2% | 25.0% | 60.2% |

## Paired tests

| Block | Comparator | Ensemble-only | Comparator-only | Exact sign p |
| --- | --- | ---: | ---: | ---: |
| Validation | appearance | 60 | 51 | 0.4478 |
| Validation | absence | 167 | 147 | 0.2836 |
| Holdout | appearance | 51 | 51 | 1.0000 |
| Holdout | absence | 148 | 163 | 0.4273 |
| Recent | appearance | 63 | 58 | 0.7163 |
| Recent | absence | 169 | 141 | 0.1250 |
| Post Cache | appearance | 5 | 13 | 0.0963 |
| Post Cache | absence | 17 | 24 | 0.3489 |
| Independent Extension | appearance | 3 | 2 | 1.0000 |
| Independent Extension | absence | 4 | 7 | 0.5488 |

## Market-specific routing test

Validation routed 3/24 market-sides away from the global blend. A local route required at least 60 validation rows and a 3-point validation advantage.

| Block | Global | Routed | Routed-only | Global-only | Exact sign p |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation | 52.1% | 52.7% | 23 | 9 | 0.0201 |
| Holdout | 50.5% | 50.6% | 17 | 15 | 0.8601 |
| Recent | 51.9% | 51.8% | 17 | 19 | 0.8679 |
| Post Cache | 45.8% | 46.2% | 3 | 2 | 1.0000 |
| Independent Extension | 60.2% | 61.4% | 1 | 0 | 1.0000 |

## Confidence gate

- Actionable calls: 0/24
- Abstentions: 24/24
- Confidence is a shrunk trailing hit rate; actionability uses the 95% Wilson lower bound, never the raw model score.
- Model A and Model B are complementary target formulations, but they use the same outcome history and must not be described as statistically independent.

## Interpretation

- The strongest confirmation-block aggregate was 60.2%, not 80%.
- The experiment directly tests the requested appearance-plus-absence ensemble. Any improvement is accepted only if it persists outside the validation block and wins paired tests.
- All available blocks are now inspected. The next honest evidence must come from predictions hash-frozen before future results.
- `FROZEN_FORWARD_REGISTRY.json` contains 0 calls and 24 abstentions for the next eligible dates on or after 2026-07-25.

## Reproduce

```powershell
python research/absent_digits_v2/run_research.py
```
