# Exact-panel event-sequence research

Rows: 16,097; event cutoff violations: 0; sequence length: 64.

| Side | Event GRU terminal | Previous terminal | Event GRU forward | Previous forward | 90% |
|---|---:|---:|---:|---:|---:|
| Open | 174/974 (17.86%) | 17.76% | 19/78 (24.36%) | 21.79% | no |
| Close | 178/974 (18.28%) | 22.18% | 12/78 (15.38%) | 19.23% | no |

## Model selection

| Candidate | Early Open | Early Close | Selection Open | Selection Close | Selection mean |
|---|---:|---:|---:|---:|---:|
| gru_e20_h64_d0.2_wd0.01 | 18.82% | 22.11% | 17.69% | 22.14% | 19.91% |
| gru_e28_h96_d0.4_wd0.03 | 18.59% | 20.41% | 16.57% | 22.91% | 19.74% |
