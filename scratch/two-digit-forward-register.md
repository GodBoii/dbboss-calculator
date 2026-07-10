# Two-Digit Forward Register

Generated: 2026-07-09T12:13:37.144Z
Calls allowed: 0
No-safe-call rows: 24

| Market | Side | Status | Avoid Pair | Context Val | Consensus Val | Gates |
|---|---|---|---:|---:|---:|---|
| Sridevi | open | NO_SAFE_CALL | - | 54.4% (49/90) | 54.4% (49/90) | context=false; consensus=false; agree=false |
| Sridevi | close | NO_SAFE_CALL | - | 60.0% (54/90) | 56.7% (51/90) | context=false; consensus=false; agree=false |
| Time Bazar | open | NO_SAFE_CALL | - | 65.6% (59/90) | 50.0% (45/90) | context=false; consensus=false; agree=false |
| Time Bazar | close | NO_SAFE_CALL | - | 66.7% (60/90) | 48.9% (44/90) | context=false; consensus=false; agree=false |
| Madhur Day | open | NO_SAFE_CALL | - | 63.3% (57/90) | 45.6% (41/90) | context=false; consensus=false; agree=false |
| Madhur Day | close | NO_SAFE_CALL | - | 62.2% (56/90) | 50.0% (45/90) | context=false; consensus=false; agree=false |
| Milan Day | open | NO_SAFE_CALL | - | 61.1% (55/90) | 46.7% (42/90) | context=false; consensus=false; agree=false |
| Milan Day | close | NO_SAFE_CALL | - | 61.1% (55/90) | 50.0% (45/90) | context=false; consensus=false; agree=false |
| Rajdhani Day | open | NO_SAFE_CALL | - | 63.3% (57/90) | 40.0% (36/90) | context=false; consensus=false; agree=false |
| Rajdhani Day | close | NO_SAFE_CALL | - | 66.7% (60/90) | 42.2% (38/90) | context=false; consensus=false; agree=false |
| Kalyan | open | NO_SAFE_CALL | - | 70.0% (63/90) | 60.0% (54/90) | context=false; consensus=false; agree=false |
| Kalyan | close | NO_SAFE_CALL | - | 57.8% (52/90) | 52.2% (47/90) | context=false; consensus=false; agree=false |
| Sridevi Night | open | NO_SAFE_CALL | - | 65.6% (59/90) | 45.6% (41/90) | context=false; consensus=false; agree=false |
| Sridevi Night | close | NO_SAFE_CALL | - | 61.1% (55/90) | 60.0% (54/90) | context=false; consensus=false; agree=false |
| Kalyan Night | open | NO_SAFE_CALL | - | 58.9% (53/90) | 53.3% (48/90) | context=false; consensus=false; agree=false |
| Kalyan Night | close | NO_SAFE_CALL | - | 57.8% (52/90) | 52.2% (47/90) | context=false; consensus=false; agree=false |
| Madhur Night | open | NO_SAFE_CALL | - | 57.8% (52/90) | 43.3% (39/90) | context=false; consensus=false; agree=false |
| Madhur Night | close | NO_SAFE_CALL | - | 73.3% (66/90) | 47.8% (43/90) | context=true; consensus=false; agree=false |
| Milan Night | open | NO_SAFE_CALL | - | 58.9% (53/90) | 48.9% (44/90) | context=false; consensus=false; agree=false |
| Milan Night | close | NO_SAFE_CALL | - | 60.0% (54/90) | 53.3% (48/90) | context=false; consensus=false; agree=false |
| Rajdhani Night | open | NO_SAFE_CALL | - | 62.2% (56/90) | 44.4% (40/90) | context=false; consensus=false; agree=false |
| Rajdhani Night | close | NO_SAFE_CALL | - | 60.0% (54/90) | 50.0% (45/90) | context=false; consensus=false; agree=true |
| Main Bazar | open | NO_SAFE_CALL | - | 57.8% (52/90) | 51.1% (46/90) | context=false; consensus=false; agree=false |
| Main Bazar | close | NO_SAFE_CALL | - | 61.1% (55/90) | 56.7% (51/90) | context=false; consensus=false; agree=false |

## How To Use

- This file is a pre-registration ledger. Do not edit it after results arrive.
- When new open/close panels are known, score only rows with status CALL.
- A call is correct only if both avoid digits are absent from the actual panel.
- Rows with NO_SAFE_CALL should be treated as abstentions, not wrong predictions.

## Gate Policy Note

- The current gates are intentionally strict because rolling context-gate frontier testing found no >=80% historical forward region.
- Do not lower the gates just to produce calls; that would increase action while reducing evidence quality.
- A future CALL should mean the model has stronger validation evidence than any region found so far.