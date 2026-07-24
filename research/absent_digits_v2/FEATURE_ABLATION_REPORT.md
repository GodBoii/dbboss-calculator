# Context Feature Ablation

Generated: 2026-07-24T12:11:06.055863+00:00

## Decision

**Rejected validation winner `without_state`.** The 75/25 family blend, EMA decay `0.97`, and weight sensitivity `35` are fixed so this audit isolates feature groups.

Promotion requires a validation gain, no Holdout or Recent regression, a paired confirmation win at p < .05, no combined later-extension regression, and no market-side worst-case loss beyond two points.

## Validation selection

| Configuration | Removed | Strict | Avg absent | Macro | Worst market-side |
| --- | --- | ---: | ---: | ---: | ---: |
| `all_features` | `nothing` | 52.1% (1224/2348) | 1.471/2 | 52.2% | 39.7% |
| `without_weekday` | `*_weekday` | 51.6% (1212/2348) | 1.462/2 | 51.6% | 35.5% |
| `without_state` | `appearance_prev_kind, absence_transition` | 52.8% (1240/2348) | 1.474/2 | 52.9% | 42.1% |
| `without_30` | `*_30` | 51.4% (1208/2348) | 1.464/2 | 51.5% | 42.1% |
| `without_90` | `*_90` | 51.8% (1217/2348) | 1.464/2 | 51.9% | 39.7% |
| `long_short_only` | `*_weekday, appearance_prev_kind, absence_transition` | 52.0% (1222/2348) | 1.462/2 | 52.1% | 44.6% |

## Selected configuration versus full baseline

| Block | Selected | Full baseline | Selected-only | Baseline-only | Pair changes | Exact sign p |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | 52.8% | 52.1% | 91 | 75 | 18.9% | 0.2442 |
| Holdout | 50.0% | 50.5% | 69 | 82 | 17.9% | 0.3288 |
| Recent | 51.7% | 51.9% | 89 | 94 | 20.0% | 0.7676 |
| Post Cache | 45.5% | 45.8% | 12 | 13 | 20.1% | 1.0000 |
| Independent Extension | 60.2% | 60.2% | 2 | 2 | 17.0% | 1.0000 |

## All removal effects

| Ablation | Validation delta | Holdout delta | Recent delta | Post-cache delta | Independent delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| `without_weekday` | -0.5 pp | -0.2 pp | -0.3 pp | +0.3 pp | -2.3 pp |
| `without_state` | +0.7 pp | -0.5 pp | -0.2 pp | -0.3 pp | +0.0 pp |
| `without_30` | -0.7 pp | +0.7 pp | -0.8 pp | +1.4 pp | +2.3 pp |
| `without_90` | -0.3 pp | +0.9 pp | +0.5 pp | +2.4 pp | +0.0 pp |
| `long_short_only` | -0.1 pp | +0.0 pp | -0.4 pp | +1.0 pp | +1.1 pp |

## Interpretation

- Each removal is applied before dynamic weights are renormalized.
- Outcomes on the target row never enter its feature estimates or weights.
- A feature is removed from runtime only when the reduced model passes every later-block promotion gate.
