# Two-Digit Consensus Safe-Call Backtest

Generated: 2026-07-09T10:18:39.453Z
Base models voted: 133
Consensus configs tested: 2100
Market-sides evaluated: 24

## 80% Validation-Gated Calls

- Selected market-sides: 0
- Strict test accuracy: n/a (0/0)
- Average correctly eliminated digits: n/a / 2
- Selected market-sides with >=80% strict test: 0/0

| Market | Side | Test Window | Validation | Test | Coverage | Config |
|---|---|---|---:|---:|---:|---|

## Best Validation Diagnostics

| Market | Side | Validation | Test | Coverage | Config |
|---|---|---:|---:|---:|---|
| Kalyan Night | open | 62.2% (56/90) | 33.3% (10/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Main Bazar | close | 60.0% (54/90) | 53.3% (16/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Main Bazar | open | 56.7% (51/90) | 50.0% (15/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Sridevi | close | 55.6% (50/90) | 53.3% (16/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Time Bazar | open | 55.6% (50/90) | 40.0% (12/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Milan Day | close | 55.6% (50/90) | 33.3% (10/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Kalyan | open | 54.4% (49/90) | 63.3% (19/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Sridevi Night | close | 54.4% (49/90) | 66.7% (20/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Kalyan | close | 51.1% (46/90) | 46.7% (14/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Sridevi | open | 48.9% (44/90) | 60.0% (18/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Madhur Day | open | 48.9% (44/90) | 40.0% (12/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Madhur Day | close | 48.9% (44/90) | 56.7% (17/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Milan Day | open | 48.9% (44/90) | 50.0% (15/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Kalyan Night | close | 48.9% (44/90) | 56.7% (17/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Milan Night | close | 48.9% (44/90) | 60.0% (18/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Sridevi Night | open | 47.8% (43/90) | 50.0% (15/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Madhur Night | close | 47.8% (43/90) | 33.3% (10/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Milan Night | open | 47.8% (43/90) | 53.3% (16/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Rajdhani Night | close | 47.8% (43/90) | 56.7% (17/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Rajdhani Night | open | 46.7% (42/90) | 40.0% (12/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Time Bazar | close | 42.2% (38/90) | 60.0% (18/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Rajdhani Day | close | 42.2% (38/90) | 33.3% (10/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Madhur Night | open | 41.1% (37/90) | 40.0% (12/30) | 30/30 | flat; votes>=8; share>=10%; margin>=1; families>=2 |
| Rajdhani Day | open | 38.2% (34/89) | 50.0% (15/30) | 30/30 | absence-context; votes>=8; share>=10%; margin>=8; families>=2 |

## Interpretation

- This test allows abstention. It only issues a pair when the 134-model catalog has enough consensus.
- A result above 80% here is not full-market coverage; it is a candidate for a no-safe-call production gate.
- Any selected pocket still needs fresh forward monitoring before real betting use.