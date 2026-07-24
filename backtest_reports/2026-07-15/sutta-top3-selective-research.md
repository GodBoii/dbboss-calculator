# Selective Top-3 / Abstention Research

Expert-agreement confidence and thresholds are selected on development only. Every accuracy is accompanied by coverage, number of calls, and a Wilson interval. The 90% gate also requires at least 30 calls in validation and holdout and 10 calls in the frozen forward block.

| Target | Frozen policy | Development | Validation | Holdout | Frozen forward | 90% gate |
| --- | --- | --- | --- | --- | --- | --- |
| Open digit | `mass >= 0.511111` | 363/1332 (27.3%), coverage 100.0%, CI 24.9-29.7% | 280/1001 (28.0%), coverage 100.0%, CI 25.3-30.8% | 315/1012 (31.1%), coverage 100.0%, CI 28.4-34.0% | 19/72 (26.4%), coverage 100.0%, CI 17.6-37.6% | reject |
| Close digit | `mass >= 0.496296` | 409/1332 (30.7%), coverage 100.0%, CI 28.3-33.2% | 303/1001 (30.3%), coverage 100.0%, CI 27.5-33.2% | 289/1012 (28.6%), coverage 100.0%, CI 25.9-31.4% | 15/71 (21.1%), coverage 98.6%, CI 13.2-32.0% | reject |
| Adjusted Close digit | `margin >= 0.163265` | 143/422 (33.9%), coverage 31.7%, CI 29.5-38.5% | 75/257 (29.2%), coverage 25.7%, CI 24.0-35.0% | 83/290 (28.6%), coverage 28.7%, CI 23.7-34.1% | 5/16 (31.2%), coverage 22.2%, CI 14.2-55.6% | reject |
| Exact Jodi (3 pairs) | `margin >= 0.076923` | 13/455 (2.9%), coverage 34.2%, CI 1.7-4.8% | 7/337 (2.1%), coverage 33.7%, CI 1.0-4.2% | 11/375 (2.9%), coverage 37.1%, CI 1.6-5.2% | 0/20 (0.0%), coverage 27.8%, CI 0.0-16.1% | reject |
| Jodi grid (9 pairs) | `margin >= 0.155556` | 17/137 (12.4%), coverage 10.3%, CI 7.9-19.0% | 6/80 (7.5%), coverage 8.0%, CI 3.5-15.4% | 6/65 (9.2%), coverage 6.4%, CI 4.3-18.7% | 0/4 (0.0%), coverage 5.6%, CI 0.0-49.0% | reject |

## Decision

No selective Top-3 contract reached 90% with the predeclared minimum sample sizes on validation, holdout, and frozen forward data.

A zero-call or tiny-call policy is not accepted as a model. Coverage cannot be hidden when evaluating abstention.
