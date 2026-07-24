# Top-3 Panel-Aware Research

Scope: research only. Production application and model files are not modified.

This cycle represents completed prior panels as exact three-digit tokens, sorted tokens, and structural states (sum, unique-digit count, and span). It tests additive categorical models and factorization-machine interactions. Ordinary Open, Close, and exact Jodi use only information available before the target Open; adjusted Close may also use the current published Open panel.

Input cache SHA-256: `8674f471f4056ce2c2eb18508952604834f5c1d94577bef11cde7e7d7f1318c3`.

| Target | Development-selected model | Development | Validation | Holdout | Frozen forward | Promote | 90% gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Open | `structure:fm:f4:wd0.01` e2 | 388/1321 (29.4%) -> 417/1321 (31.6%) (+29) | 300/990 (30.3%) -> 262/990 (26.5%) (-38) | 317/1000 (31.7%) -> 284/1000 (28.4%) (-33) | 17/72 (23.6%) -> 23/72 (31.9%) (+6) | no | fail |
| Close | `token:additive:f0:wd0.01` e2 | 419/1321 (31.7%) -> 416/1321 (31.5%) (-3) | 298/990 (30.1%) -> 300/990 (30.3%) (+2) | 328/1000 (32.8%) -> 287/1000 (28.7%) (-41) | 18/72 (25.0%) -> 24/72 (33.3%) (+6) | no | fail |
| Adjusted Close + Open panel | `token:fm:f4:wd0.01` e28 | 419/1321 (31.7%) -> 435/1321 (32.9%) (+16) | 298/990 (30.1%) -> 311/990 (31.4%) (+13) | 328/1000 (32.8%) -> 302/1000 (30.2%) (-26) | 18/72 (25.0%) -> 17/72 (23.6%) (-1) | no | fail |
| Exact Jodi | `token:fm:f4:wd0.01` e12 | 37/1321 (2.8%) -> 50/1321 (3.8%) (+13) | 29/990 (2.9%) -> 26/990 (2.6%) (-3) | 30/1000 (3.0%) -> 36/1000 (3.6%) (+6) | 0/72 (0.0%) -> 5/72 (6.9%) (+5) | no | fail |

Model and representation are selected on development only. Validation, holdout, and the frozen forward week never select the winner. A candidate is promotable only with a development gain and no regression in every later block; the requested gate additionally requires at least 90% in every block.
