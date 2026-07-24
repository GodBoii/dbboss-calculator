# Top-3 Causal ML Research

Every prediction contains exactly three candidates. Open and Close are three digits; Jodi is three exact pairs (not a 3x3 rectangle). Adjusted Close may use the already-known current Open digit. Hyperparameters and stopping epochs are selected on development only.

| Target | Model | Development | Validation | Holdout | Frozen forward | Promote |
| --- | --- | --- | --- | --- | --- | --- |
| Open | `mlp:e4:h48:d0.15:wd0.001` e1 | 388/1321 (29.4%) -> 410/1321 (31.0%) (+22) | 300/990 (30.3%) -> 310/990 (31.3%) (+10) | 317/1000 (31.7%) -> 274/1000 (27.4%) (-43) | 17/72 (23.6%) -> 23/72 (31.9%) (+6) | no |
| Close | `mlp:e4:h48:d0.15:wd0.001` e7 | 419/1321 (31.7%) -> 431/1321 (32.6%) (+12) | 298/990 (30.1%) -> 295/990 (29.8%) (-3) | 328/1000 (32.8%) -> 305/1000 (30.5%) (-23) | 18/72 (25.0%) -> 16/72 (22.2%) (-2) | no |
| Adjusted Close | `mlp:e4:h64:d0.3:wd0.003` e3 | 419/1321 (31.7%) -> 427/1321 (32.3%) (+8) | 298/990 (30.1%) -> 299/990 (30.2%) (+1) | 328/1000 (32.8%) -> 321/1000 (32.1%) (-7) | 18/72 (25.0%) -> 17/72 (23.6%) (-1) | no |
| Exact Jodi | `mlp:e4:h64:d0.3:wd0.003` e5 | 37/1321 (2.8%) -> 47/1321 (3.6%) (+10) | 29/990 (2.9%) -> 33/990 (3.3%) (+4) | 30/1000 (3.0%) -> 33/1000 (3.3%) (+3) | 0/72 (0.0%) -> 3/72 (4.2%) (+3) | yes |

The baseline for Open and Close is the first three positions of the frozen production ranking. The exact-Jodi baseline chooses the three best rank-product pairs. Adjusted Close is compared with the pre-open Close top three, so a gain measures the value of revealing Open.

A model is promotable only with a development gain and no regression on validation, chronological holdout, or frozen forward evidence.
