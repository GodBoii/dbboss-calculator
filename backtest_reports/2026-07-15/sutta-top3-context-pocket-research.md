# Top-3 Context-Pocket False-Discovery Audit

A context key is accepted only when its development accuracy is at least 90%. The context family and exact accepted keys are then frozen. Tiny pockets are shown to quantify false discoveries; the final gate still requires at least 30 validation calls, 30 holdout calls, and 10 forward calls at 90% accuracy.

| Target | Development-selected pocket policy | Development | Validation | Holdout | Frozen forward | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Open digit | `market_prev_jodi`, support 3, 1 pockets | 3/3 (100.0%), coverage 0.2% | 0/0 (0.0%), coverage 0.0% | 1/2 (50.0%), coverage 0.2% | 0/0 (0.0%), coverage 0.0% | reject |
| Close digit | `market_prev_jodi`, support 3, 4 pockets | 14/14 (100.0%), coverage 1.1% | 0/3 (0.0%), coverage 0.3% | 0/3 (0.0%), coverage 0.3% | 0/0 (0.0%), coverage 0.0% | reject |
| Adjusted Close digit | `market_prev_jodi`, support 3, 4 pockets | 14/14 (100.0%), coverage 1.1% | 0/3 (0.0%), coverage 0.3% | 0/3 (0.0%), coverage 0.3% | 0/0 (0.0%), coverage 0.0% | reject |
| Exact Jodi (3 pairs) | `weekday_prev_open`, support 20, 0 pockets | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | reject |
| Jodi grid (9 pairs) | `weekday_prev_open`, support 20, 0 pockets | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | reject |

## Support sensitivity

| Target | Minimum support | Best development family | Pockets | Development | Validation | Holdout | Forward |
| --- | ---: | --- | ---: | --- | --- | --- | --- |
| Open digit | 3 | `market_prev_jodi` | 1 | 3/3 (100.0%), coverage 0.2% | 0/0 (0.0%), coverage 0.0% | 1/2 (50.0%), coverage 0.2% | 0/0 (0.0%), coverage 0.0% |
| Open digit | 5 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Open digit | 10 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Open digit | 20 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Close digit | 3 | `market_prev_jodi` | 4 | 14/14 (100.0%), coverage 1.1% | 0/3 (0.0%), coverage 0.3% | 0/3 (0.0%), coverage 0.3% | 0/0 (0.0%), coverage 0.0% |
| Close digit | 5 | `market_prev_jodi` | 1 | 5/5 (100.0%), coverage 0.4% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Close digit | 10 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Close digit | 20 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Adjusted Close digit | 3 | `market_prev_jodi` | 4 | 14/14 (100.0%), coverage 1.1% | 0/3 (0.0%), coverage 0.3% | 0/3 (0.0%), coverage 0.3% | 0/0 (0.0%), coverage 0.0% |
| Adjusted Close digit | 5 | `current_open_prev_close` | 1 | 7/7 (100.0%), coverage 0.5% | 4/9 (44.4%), coverage 0.9% | 2/4 (50.0%), coverage 0.4% | 0/1 (0.0%), coverage 1.4% |
| Adjusted Close digit | 10 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Adjusted Close digit | 20 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Exact Jodi (3 pairs) | 3 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Exact Jodi (3 pairs) | 5 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Exact Jodi (3 pairs) | 10 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Exact Jodi (3 pairs) | 20 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Jodi grid (9 pairs) | 3 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Jodi grid (9 pairs) | 5 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Jodi grid (9 pairs) | 10 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |
| Jodi grid (9 pairs) | 20 | `market_weekday` | 0 | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% | 0/0 (0.0%), coverage 0.0% |

## Decision

No context-pocket policy is accepted unless it survives all later blocks with the stated minimum calls. Apparent 90%-100% development pockets with small support are treated as multiple-testing artifacts when their later accuracy collapses.
