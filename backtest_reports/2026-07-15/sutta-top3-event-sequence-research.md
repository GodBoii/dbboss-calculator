# Top-3 Cross-Market Event-Sequence Research

Scope: research only. Production application and model files are not modified.

A multitask GRU consumes the last 64 completed market events ordered by their actual Close times. Shared Open, Close, and exact-Jodi heads never receive the target event. Only adjusted Close receives the current Open digit and Open panel. Architecture and stopping epoch are selected by mean development Top-3 accuracy across all four contracts.

Input cache SHA-256: `8674f471f4056ce2c2eb18508952604834f5c1d94577bef11cde7e7d7f1318c3`.

Selected model: `gru:e32:h64:d0.3:wd0.01` at epoch 5.

| Target | Development | Validation | Holdout | Frozen forward | Promote | 90% gate |
| --- | --- | --- | --- | --- | --- | --- |
| Open | 388/1321 (29.4%) -> 411/1321 (31.1%) (+23) | 300/990 (30.3%) -> 296/990 (29.9%) (-4) | 317/1000 (31.7%) -> 284/1000 (28.4%) (-33) | 17/72 (23.6%) -> 23/72 (31.9%) (+6) | no | fail |
| Close | 419/1321 (31.7%) -> 400/1321 (30.3%) (-19) | 298/990 (30.1%) -> 297/990 (30.0%) (-1) | 328/1000 (32.8%) -> 280/1000 (28.0%) (-48) | 18/72 (25.0%) -> 15/72 (20.8%) (-3) | no | fail |
| Adjusted Close + Open panel | 419/1321 (31.7%) -> 438/1321 (33.2%) (+19) | 298/990 (30.1%) -> 300/990 (30.3%) (+2) | 328/1000 (32.8%) -> 301/1000 (30.1%) (-27) | 18/72 (25.0%) -> 24/72 (33.3%) (+6) | no | fail |
| Exact Jodi | 37/1321 (2.8%) -> 42/1321 (3.2%) (+5) | 29/990 (2.9%) -> 25/990 (2.5%) (-4) | 30/1000 (3.0%) -> 24/1000 (2.4%) (-6) | 0/72 (0.0%) -> 2/72 (2.8%) (+2) | no | fail |

The event cutoff invariant was checked for every row: the latest encoded event is strictly earlier than the target market's Open time.
