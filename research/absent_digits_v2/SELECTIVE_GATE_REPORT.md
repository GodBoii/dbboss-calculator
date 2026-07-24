# Selective Agreement and Confidence Gate Audit

Generated: 2026-07-24T12:13:41.030457+00:00

## Decision

**Rejected validation gate `confidence_ge_052`.** No retrospective gate can authorize runtime calls; the frozen 80% Wilson action rule remains controlling.

Validation candidates require at least 235 rows (10% coverage, with a 200-row floor) and are ranked by Wilson lower bound.

## Validation selection

| Gate | Eligible | Coverage | Hits | Accuracy | Wilson 95% lower | Random reference | Excess |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `all` | yes | 100.0% | 1224/2348 | 52.1% | 50.1% | 50.5% | +1.6 pp |
| `agreement` | yes | 54.9% | 670/1288 | 52.0% | 49.3% | 50.4% | +1.6 pp |
| `confidence_ge_050` | yes | 76.4% | 940/1795 | 52.4% | 50.1% | 50.5% | +1.9 pp |
| `confidence_ge_052` | yes | 53.0% | 670/1245 | 53.8% | 51.0% | 50.5% | +3.3 pp |
| `confidence_ge_054` | yes | 10.8% | 127/254 | 50.0% | 43.9% | 49.4% | +0.6 pp |
| `confidence_ge_056` | no | 0.3% | 5/8 | 62.5% | 30.6% | 46.7% | +15.8 pp |
| `agreement_confidence_ge_050` | yes | 43.0% | 529/1009 | 52.4% | 49.3% | 50.3% | +2.2 pp |
| `agreement_confidence_ge_052` | yes | 31.5% | 394/740 | 53.2% | 49.6% | 50.4% | +2.8 pp |
| `agreement_confidence_ge_054` | no | 7.4% | 90/173 | 52.0% | 44.6% | 49.5% | +2.6 pp |

## Chronological selected-gate performance

| Block | Coverage | Selected | All rows | Selected Wilson lower | Random excess | Clustered 95% interval |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | 53.0% | 53.8% | 52.1% | 51.0% | +3.3 pp | [+0.8, +6.0] pp |
| Holdout | 42.5% | 48.9% | 50.5% | 45.9% | -1.6 pp | [-4.5, +1.1] pp |
| Recent | 32.5% | 52.4% | 51.9% | 48.8% | +1.5 pp | [-1.8, +5.1] pp |
| Post Cache | 31.2% | 45.6% | 45.8% | 35.7% | -3.9 pp | [-7.9, +0.1] pp |
| Independent Extension | 28.4% | 68.0% | 60.2% | 48.4% | +14.5 pp | [+14.5, +14.5] pp |

## Confirmation contrasts

- Selected versus excluded: 50.4% versus 51.7%; difference -1.3 pp, two-sided z p=0.3829.
- Selected versus panel-kind random reference: -0.3 pp; week-clustered 95% interval [-2.6, +1.9] pp.
- Confirmation Wilson lower bound: 48.1%; 80% gate passed: no.

## Interpretation

- Model-family agreement is not independent evidence because both families learn from the same outcomes.
- Confidence thresholds use only earlier market-side hits and the promoted 240-draw beta calibration.
- Coverage, selected-versus-excluded separation, random-reference excess, and later stability must all agree before a gate advances.
