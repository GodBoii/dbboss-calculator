# Pooled DP diagnostic

Post-hoc diagnostic on dates already used by V7. No prospective claim or production promotion.

The routing rule was frozen in pooled_dp_results.json before diagnostic predictions and audit counts: replace only the close_pre DP slot when early development DP support is below 15 or early validation DP support below 8. Use early ALL-selected expert 326, v6/digit_symmetry/transform=rotate1/alpha=0.5. All other probability slots remain byte-identical. All 12 markets qualify (1201 rows).

Open and close_known selected production globally (index 0), so no alternative pooled DP candidate exists for those channels.

All 795 variants plus three exact output controls were scored. Selection uses September 8-30 and October 1-15 only. All five components must preserve fit-block counts against both production and the modified specialist bundle. Later audits do not select candidates. ALL chooses production; Kalyan alone selects fusion 351.

Direct DP specialist comparison:

| Market | Block | Old DP | Pooled DP | Eligible |
|---|---|---:|---:|---:|
| ALL | weight_train | 12 | 18 | 51 |
| ALL | weight_validation | 10 | 13 | 41 |
| ALL | late_reused | 4 | 3 | 14 |
| ALL | november_reused | 5 | 5 | 21 |
| Kalyan | weight_train | 1 | 3 | 8 |
| Kalyan | weight_validation | 1 | 1 | 4 |
| Kalyan | late_reused | 1 | 0 | 1 |
| Kalyan | november_reused | 1 | 0 | 1 |
| Kalyan Night | weight_train | 1 | 1 | 4 |
| Kalyan Night | weight_validation | 0 | 0 | 2 |
| Kalyan Night | late_reused | 0 | 0 | 1 |
| Kalyan Night | november_reused | 0 | 0 | 1 |
| Madhur Day | weight_train | 1 | 2 | 4 |
| Madhur Day | weight_validation | 1 | 2 | 4 |
| Madhur Day | late_reused | 1 | 1 | 2 |
| Madhur Day | november_reused | 0 | 1 | 1 |
| Madhur Night | weight_train | 4 | 3 | 9 |
| Madhur Night | weight_validation | 0 | 1 | 1 |
| Madhur Night | late_reused | 0 | 0 | 0 |
| Madhur Night | november_reused | 0 | 0 | 0 |
| Main Bazar | weight_train | 0 | 1 | 3 |
| Main Bazar | weight_validation | 0 | 1 | 4 |
| Main Bazar | late_reused | 0 | 0 | 1 |
| Main Bazar | november_reused | 0 | 0 | 0 |
| Milan Day | weight_train | 0 | 0 | 2 |
| Milan Day | weight_validation | 1 | 3 | 8 |
| Milan Day | late_reused | 1 | 2 | 5 |
| Milan Day | november_reused | 1 | 1 | 4 |
| Milan Night | weight_train | 0 | 0 | 0 |
| Milan Night | weight_validation | 1 | 1 | 5 |
| Milan Night | late_reused | 0 | 0 | 1 |
| Milan Night | november_reused | 1 | 0 | 2 |
| Rajdhani Day | weight_train | 3 | 3 | 7 |
| Rajdhani Day | weight_validation | 0 | 1 | 2 |
| Rajdhani Day | late_reused | 0 | 0 | 1 |
| Rajdhani Day | november_reused | 0 | 1 | 2 |
| Rajdhani Night | weight_train | 0 | 1 | 2 |
| Rajdhani Night | weight_validation | 0 | 1 | 2 |
| Rajdhani Night | late_reused | 0 | 0 | 1 |
| Rajdhani Night | november_reused | 0 | 0 | 2 |
| Sridevi | weight_train | 0 | 1 | 4 |
| Sridevi | weight_validation | 2 | 0 | 3 |
| Sridevi | late_reused | 0 | 0 | 0 |
| Sridevi | november_reused | 1 | 0 | 2 |
| Sridevi Night | weight_train | 1 | 2 | 5 |
| Sridevi Night | weight_validation | 3 | 2 | 5 |
| Sridevi Night | late_reused | 0 | 0 | 0 |
| Sridevi Night | november_reused | 0 | 0 | 2 |
| Time Bazar | weight_train | 1 | 1 | 3 |
| Time Bazar | weight_validation | 1 | 0 | 1 |
| Time Bazar | late_reused | 1 | 0 | 1 |
| Time Bazar | november_reused | 1 | 2 | 4 |

All five components after guarded fusion:

| Market | Block | Metric | Production | Original selected | Pooled selected | Eligible |
|---|---|---|---:|---:|---:|---:|
| ALL | weight_train | top5 | 115 | 115 | 115 | 237 |
| ALL | weight_train | avoid2 | 118 | 118 | 118 | 237 |
| ALL | weight_train | panel10 | 14 | 14 | 14 | 237 |
| ALL | weight_train | sp30 | 47 | 47 | 47 | 186 |
| ALL | weight_train | dp20 | 12 | 12 | 12 | 51 |
| ALL | weight_validation | top5 | 69 | 69 | 69 | 152 |
| ALL | weight_validation | avoid2 | 77 | 77 | 77 | 152 |
| ALL | weight_validation | panel10 | 11 | 11 | 11 | 152 |
| ALL | weight_validation | sp30 | 28 | 28 | 28 | 111 |
| ALL | weight_validation | dp20 | 10 | 10 | 10 | 41 |
| ALL | late_reused | top5 | 29 | 29 | 29 | 61 |
| ALL | late_reused | avoid2 | 37 | 37 | 37 | 61 |
| ALL | late_reused | panel10 | 4 | 4 | 4 | 61 |
| ALL | late_reused | sp30 | 13 | 13 | 13 | 46 |
| ALL | late_reused | dp20 | 4 | 4 | 4 | 14 |
| ALL | november_reused | top5 | 45 | 45 | 45 | 88 |
| ALL | november_reused | avoid2 | 43 | 43 | 43 | 88 |
| ALL | november_reused | panel10 | 5 | 5 | 5 | 88 |
| ALL | november_reused | sp30 | 14 | 14 | 14 | 66 |
| ALL | november_reused | dp20 | 5 | 5 | 5 | 21 |
| Kalyan | weight_train | top5 | 9 | 11 | 11 | 20 |
| Kalyan | weight_train | avoid2 | 11 | 11 | 11 | 20 |
| Kalyan | weight_train | panel10 | 0 | 3 | 2 | 20 |
| Kalyan | weight_train | sp30 | 2 | 6 | 6 | 12 |
| Kalyan | weight_train | dp20 | 1 | 3 | 4 | 8 |
| Kalyan | weight_validation | top5 | 5 | 8 | 8 | 13 |
| Kalyan | weight_validation | avoid2 | 3 | 10 | 8 | 13 |
| Kalyan | weight_validation | panel10 | 0 | 1 | 1 | 13 |
| Kalyan | weight_validation | sp30 | 1 | 1 | 2 | 9 |
| Kalyan | weight_validation | dp20 | 1 | 1 | 1 | 4 |
| Kalyan | late_reused | top5 | 2 | 4 | 4 | 5 |
| Kalyan | late_reused | avoid2 | 5 | 3 | 2 | 5 |
| Kalyan | late_reused | panel10 | 0 | 0 | 0 | 5 |
| Kalyan | late_reused | sp30 | 1 | 1 | 1 | 4 |
| Kalyan | late_reused | dp20 | 1 | 1 | 1 | 1 |
| Kalyan | november_reused | top5 | 5 | 3 | 3 | 8 |
| Kalyan | november_reused | avoid2 | 4 | 5 | 7 | 8 |
| Kalyan | november_reused | panel10 | 1 | 1 | 1 | 8 |
| Kalyan | november_reused | sp30 | 2 | 2 | 2 | 7 |
| Kalyan | november_reused | dp20 | 1 | 1 | 1 | 1 |
| Kalyan Night | weight_train | top5 | 10 | 10 | 10 | 17 |
| Kalyan Night | weight_train | avoid2 | 8 | 8 | 8 | 17 |
| Kalyan Night | weight_train | panel10 | 2 | 2 | 2 | 17 |
| Kalyan Night | weight_train | sp30 | 5 | 5 | 5 | 13 |
| Kalyan Night | weight_train | dp20 | 1 | 1 | 1 | 4 |
| Kalyan Night | weight_validation | top5 | 5 | 5 | 5 | 11 |
| Kalyan Night | weight_validation | avoid2 | 3 | 3 | 3 | 11 |
| Kalyan Night | weight_validation | panel10 | 1 | 1 | 1 | 11 |
| Kalyan Night | weight_validation | sp30 | 2 | 2 | 2 | 9 |
| Kalyan Night | weight_validation | dp20 | 0 | 0 | 0 | 2 |
| Kalyan Night | late_reused | top5 | 3 | 3 | 3 | 5 |
| Kalyan Night | late_reused | avoid2 | 4 | 4 | 4 | 5 |
| Kalyan Night | late_reused | panel10 | 1 | 1 | 1 | 5 |
| Kalyan Night | late_reused | sp30 | 1 | 1 | 1 | 4 |
| Kalyan Night | late_reused | dp20 | 0 | 0 | 0 | 1 |
| Kalyan Night | november_reused | top5 | 3 | 3 | 3 | 6 |
| Kalyan Night | november_reused | avoid2 | 2 | 2 | 2 | 6 |
| Kalyan Night | november_reused | panel10 | 1 | 1 | 1 | 6 |
| Kalyan Night | november_reused | sp30 | 1 | 1 | 1 | 5 |
| Kalyan Night | november_reused | dp20 | 0 | 0 | 0 | 1 |
| Madhur Day | weight_train | top5 | 14 | 14 | 14 | 23 |
| Madhur Day | weight_train | avoid2 | 14 | 14 | 14 | 23 |
| Madhur Day | weight_train | panel10 | 1 | 1 | 1 | 23 |
| Madhur Day | weight_train | sp30 | 4 | 4 | 4 | 19 |
| Madhur Day | weight_train | dp20 | 1 | 1 | 1 | 4 |
| Madhur Day | weight_validation | top5 | 8 | 8 | 8 | 15 |
| Madhur Day | weight_validation | avoid2 | 6 | 6 | 6 | 15 |
| Madhur Day | weight_validation | panel10 | 0 | 0 | 0 | 15 |
| Madhur Day | weight_validation | sp30 | 0 | 0 | 0 | 11 |
| Madhur Day | weight_validation | dp20 | 1 | 1 | 1 | 4 |
| Madhur Day | late_reused | top5 | 2 | 2 | 2 | 7 |
| Madhur Day | late_reused | avoid2 | 4 | 4 | 4 | 7 |
| Madhur Day | late_reused | panel10 | 1 | 1 | 1 | 7 |
| Madhur Day | late_reused | sp30 | 2 | 2 | 2 | 5 |
| Madhur Day | late_reused | dp20 | 1 | 1 | 1 | 2 |
| Madhur Day | november_reused | top5 | 6 | 6 | 6 | 10 |
| Madhur Day | november_reused | avoid2 | 6 | 6 | 6 | 10 |
| Madhur Day | november_reused | panel10 | 2 | 2 | 2 | 10 |
| Madhur Day | november_reused | sp30 | 4 | 4 | 4 | 8 |
| Madhur Day | november_reused | dp20 | 0 | 0 | 0 | 1 |
| Madhur Night | weight_train | top5 | 8 | 8 | 8 | 20 |
| Madhur Night | weight_train | avoid2 | 15 | 15 | 15 | 20 |
| Madhur Night | weight_train | panel10 | 1 | 1 | 1 | 20 |
| Madhur Night | weight_train | sp30 | 4 | 4 | 4 | 11 |
| Madhur Night | weight_train | dp20 | 4 | 4 | 4 | 9 |
| Madhur Night | weight_validation | top5 | 3 | 3 | 3 | 9 |
| Madhur Night | weight_validation | avoid2 | 4 | 4 | 4 | 9 |
| Madhur Night | weight_validation | panel10 | 0 | 0 | 0 | 9 |
| Madhur Night | weight_validation | sp30 | 1 | 1 | 1 | 8 |
| Madhur Night | weight_validation | dp20 | 0 | 0 | 0 | 1 |
| Madhur Night | late_reused | top5 | 0 | 0 | 0 | 0 |
| Madhur Night | late_reused | avoid2 | 0 | 0 | 0 | 0 |
| Madhur Night | late_reused | panel10 | 0 | 0 | 0 | 0 |
| Madhur Night | late_reused | sp30 | 0 | 0 | 0 | 0 |
| Madhur Night | late_reused | dp20 | 0 | 0 | 0 | 0 |
| Madhur Night | november_reused | top5 | 0 | 0 | 0 | 0 |
| Madhur Night | november_reused | avoid2 | 0 | 0 | 0 | 0 |
| Madhur Night | november_reused | panel10 | 0 | 0 | 0 | 0 |
| Madhur Night | november_reused | sp30 | 0 | 0 | 0 | 0 |
| Madhur Night | november_reused | dp20 | 0 | 0 | 0 | 0 |
| Main Bazar | weight_train | top5 | 7 | 7 | 7 | 17 |
| Main Bazar | weight_train | avoid2 | 9 | 9 | 9 | 17 |
| Main Bazar | weight_train | panel10 | 0 | 0 | 0 | 17 |
| Main Bazar | weight_train | sp30 | 1 | 1 | 1 | 14 |
| Main Bazar | weight_train | dp20 | 0 | 0 | 0 | 3 |
| Main Bazar | weight_validation | top5 | 5 | 6 | 5 | 11 |
| Main Bazar | weight_validation | avoid2 | 7 | 8 | 7 | 11 |
| Main Bazar | weight_validation | panel10 | 2 | 2 | 2 | 11 |
| Main Bazar | weight_validation | sp30 | 4 | 5 | 4 | 7 |
| Main Bazar | weight_validation | dp20 | 0 | 0 | 0 | 4 |
| Main Bazar | late_reused | top5 | 4 | 3 | 4 | 5 |
| Main Bazar | late_reused | avoid2 | 4 | 2 | 4 | 5 |
| Main Bazar | late_reused | panel10 | 0 | 0 | 0 | 5 |
| Main Bazar | late_reused | sp30 | 1 | 1 | 1 | 4 |
| Main Bazar | late_reused | dp20 | 0 | 0 | 0 | 1 |
| Main Bazar | november_reused | top5 | 4 | 4 | 4 | 6 |
| Main Bazar | november_reused | avoid2 | 2 | 1 | 2 | 6 |
| Main Bazar | november_reused | panel10 | 0 | 0 | 0 | 6 |
| Main Bazar | november_reused | sp30 | 1 | 2 | 1 | 6 |
| Main Bazar | november_reused | dp20 | 0 | 0 | 0 | 0 |
| Milan Day | weight_train | top5 | 6 | 6 | 6 | 19 |
| Milan Day | weight_train | avoid2 | 6 | 6 | 6 | 19 |
| Milan Day | weight_train | panel10 | 2 | 2 | 2 | 19 |
| Milan Day | weight_train | sp30 | 2 | 2 | 2 | 17 |
| Milan Day | weight_train | dp20 | 0 | 0 | 0 | 2 |
| Milan Day | weight_validation | top5 | 7 | 7 | 7 | 13 |
| Milan Day | weight_validation | avoid2 | 9 | 9 | 9 | 13 |
| Milan Day | weight_validation | panel10 | 0 | 0 | 0 | 13 |
| Milan Day | weight_validation | sp30 | 1 | 1 | 1 | 5 |
| Milan Day | weight_validation | dp20 | 1 | 1 | 1 | 8 |
| Milan Day | late_reused | top5 | 3 | 3 | 3 | 5 |
| Milan Day | late_reused | avoid2 | 3 | 3 | 3 | 5 |
| Milan Day | late_reused | panel10 | 0 | 0 | 0 | 5 |
| Milan Day | late_reused | sp30 | 0 | 0 | 0 | 0 |
| Milan Day | late_reused | dp20 | 1 | 1 | 1 | 5 |
| Milan Day | november_reused | top5 | 6 | 6 | 6 | 8 |
| Milan Day | november_reused | avoid2 | 4 | 4 | 4 | 8 |
| Milan Day | november_reused | panel10 | 1 | 1 | 1 | 8 |
| Milan Day | november_reused | sp30 | 1 | 1 | 1 | 4 |
| Milan Day | november_reused | dp20 | 1 | 1 | 1 | 4 |
| Milan Night | weight_train | top5 | 13 | 13 | 13 | 19 |
| Milan Night | weight_train | avoid2 | 9 | 9 | 9 | 19 |
| Milan Night | weight_train | panel10 | 0 | 0 | 0 | 19 |
| Milan Night | weight_train | sp30 | 3 | 3 | 3 | 19 |
| Milan Night | weight_train | dp20 | 0 | 0 | 0 | 0 |
| Milan Night | weight_validation | top5 | 7 | 7 | 7 | 13 |
| Milan Night | weight_validation | avoid2 | 7 | 7 | 7 | 13 |
| Milan Night | weight_validation | panel10 | 0 | 0 | 0 | 13 |
| Milan Night | weight_validation | sp30 | 1 | 1 | 1 | 8 |
| Milan Night | weight_validation | dp20 | 1 | 1 | 1 | 5 |
| Milan Night | late_reused | top5 | 2 | 2 | 2 | 5 |
| Milan Night | late_reused | avoid2 | 3 | 3 | 3 | 5 |
| Milan Night | late_reused | panel10 | 0 | 0 | 0 | 5 |
| Milan Night | late_reused | sp30 | 1 | 1 | 1 | 4 |
| Milan Night | late_reused | dp20 | 0 | 0 | 0 | 1 |
| Milan Night | november_reused | top5 | 4 | 4 | 4 | 8 |
| Milan Night | november_reused | avoid2 | 4 | 4 | 4 | 8 |
| Milan Night | november_reused | panel10 | 0 | 0 | 0 | 8 |
| Milan Night | november_reused | sp30 | 1 | 1 | 1 | 6 |
| Milan Night | november_reused | dp20 | 1 | 1 | 1 | 2 |
| Rajdhani Day | weight_train | top5 | 7 | 7 | 7 | 20 |
| Rajdhani Day | weight_train | avoid2 | 10 | 10 | 10 | 20 |
| Rajdhani Day | weight_train | panel10 | 2 | 2 | 2 | 20 |
| Rajdhani Day | weight_train | sp30 | 6 | 6 | 6 | 13 |
| Rajdhani Day | weight_train | dp20 | 3 | 3 | 3 | 7 |
| Rajdhani Day | weight_validation | top5 | 7 | 7 | 7 | 13 |
| Rajdhani Day | weight_validation | avoid2 | 7 | 7 | 7 | 13 |
| Rajdhani Day | weight_validation | panel10 | 3 | 3 | 3 | 13 |
| Rajdhani Day | weight_validation | sp30 | 5 | 5 | 5 | 11 |
| Rajdhani Day | weight_validation | dp20 | 0 | 0 | 0 | 2 |
| Rajdhani Day | late_reused | top5 | 3 | 3 | 3 | 5 |
| Rajdhani Day | late_reused | avoid2 | 3 | 3 | 3 | 5 |
| Rajdhani Day | late_reused | panel10 | 0 | 0 | 0 | 5 |
| Rajdhani Day | late_reused | sp30 | 2 | 2 | 2 | 4 |
| Rajdhani Day | late_reused | dp20 | 0 | 0 | 0 | 1 |
| Rajdhani Day | november_reused | top5 | 4 | 4 | 4 | 8 |
| Rajdhani Day | november_reused | avoid2 | 5 | 5 | 5 | 8 |
| Rajdhani Day | november_reused | panel10 | 0 | 0 | 0 | 8 |
| Rajdhani Day | november_reused | sp30 | 0 | 0 | 0 | 6 |
| Rajdhani Day | november_reused | dp20 | 0 | 0 | 0 | 2 |
| Rajdhani Night | weight_train | top5 | 12 | 12 | 12 | 17 |
| Rajdhani Night | weight_train | avoid2 | 8 | 8 | 8 | 17 |
| Rajdhani Night | weight_train | panel10 | 1 | 1 | 1 | 17 |
| Rajdhani Night | weight_train | sp30 | 5 | 5 | 5 | 15 |
| Rajdhani Night | weight_train | dp20 | 0 | 0 | 0 | 2 |
| Rajdhani Night | weight_validation | top5 | 2 | 2 | 2 | 11 |
| Rajdhani Night | weight_validation | avoid2 | 8 | 8 | 8 | 11 |
| Rajdhani Night | weight_validation | panel10 | 1 | 1 | 1 | 11 |
| Rajdhani Night | weight_validation | sp30 | 2 | 2 | 2 | 9 |
| Rajdhani Night | weight_validation | dp20 | 0 | 0 | 0 | 2 |
| Rajdhani Night | late_reused | top5 | 2 | 2 | 2 | 5 |
| Rajdhani Night | late_reused | avoid2 | 3 | 3 | 3 | 5 |
| Rajdhani Night | late_reused | panel10 | 0 | 0 | 0 | 5 |
| Rajdhani Night | late_reused | sp30 | 0 | 0 | 0 | 4 |
| Rajdhani Night | late_reused | dp20 | 0 | 0 | 0 | 1 |
| Rajdhani Night | november_reused | top5 | 2 | 2 | 2 | 6 |
| Rajdhani Night | november_reused | avoid2 | 0 | 0 | 0 | 6 |
| Rajdhani Night | november_reused | panel10 | 0 | 0 | 0 | 6 |
| Rajdhani Night | november_reused | sp30 | 1 | 1 | 1 | 4 |
| Rajdhani Night | november_reused | dp20 | 0 | 0 | 0 | 2 |
| Sridevi | weight_train | top5 | 13 | 13 | 13 | 23 |
| Sridevi | weight_train | avoid2 | 9 | 9 | 9 | 23 |
| Sridevi | weight_train | panel10 | 2 | 2 | 2 | 23 |
| Sridevi | weight_train | sp30 | 3 | 3 | 3 | 19 |
| Sridevi | weight_train | dp20 | 0 | 0 | 0 | 4 |
| Sridevi | weight_validation | top5 | 6 | 6 | 6 | 15 |
| Sridevi | weight_validation | avoid2 | 6 | 6 | 6 | 15 |
| Sridevi | weight_validation | panel10 | 2 | 2 | 2 | 15 |
| Sridevi | weight_validation | sp30 | 3 | 3 | 3 | 12 |
| Sridevi | weight_validation | dp20 | 2 | 2 | 2 | 3 |
| Sridevi | late_reused | top5 | 3 | 3 | 3 | 7 |
| Sridevi | late_reused | avoid2 | 5 | 5 | 5 | 7 |
| Sridevi | late_reused | panel10 | 1 | 1 | 1 | 7 |
| Sridevi | late_reused | sp30 | 2 | 2 | 2 | 6 |
| Sridevi | late_reused | dp20 | 0 | 0 | 0 | 0 |
| Sridevi | november_reused | top5 | 4 | 4 | 4 | 10 |
| Sridevi | november_reused | avoid2 | 4 | 4 | 4 | 10 |
| Sridevi | november_reused | panel10 | 0 | 0 | 0 | 10 |
| Sridevi | november_reused | sp30 | 2 | 2 | 2 | 8 |
| Sridevi | november_reused | dp20 | 1 | 1 | 1 | 2 |
| Sridevi Night | weight_train | top5 | 10 | 10 | 10 | 23 |
| Sridevi Night | weight_train | avoid2 | 10 | 10 | 10 | 23 |
| Sridevi Night | weight_train | panel10 | 2 | 2 | 2 | 23 |
| Sridevi Night | weight_train | sp30 | 7 | 7 | 7 | 18 |
| Sridevi Night | weight_train | dp20 | 1 | 1 | 1 | 5 |
| Sridevi Night | weight_validation | top5 | 7 | 7 | 7 | 15 |
| Sridevi Night | weight_validation | avoid2 | 11 | 11 | 11 | 15 |
| Sridevi Night | weight_validation | panel10 | 0 | 0 | 0 | 15 |
| Sridevi Night | weight_validation | sp30 | 3 | 3 | 3 | 10 |
| Sridevi Night | weight_validation | dp20 | 3 | 3 | 3 | 5 |
| Sridevi Night | late_reused | top5 | 3 | 3 | 3 | 6 |
| Sridevi Night | late_reused | avoid2 | 3 | 3 | 3 | 6 |
| Sridevi Night | late_reused | panel10 | 1 | 1 | 1 | 6 |
| Sridevi Night | late_reused | sp30 | 1 | 1 | 1 | 6 |
| Sridevi Night | late_reused | dp20 | 0 | 0 | 0 | 0 |
| Sridevi Night | november_reused | top5 | 3 | 3 | 3 | 10 |
| Sridevi Night | november_reused | avoid2 | 6 | 6 | 6 | 10 |
| Sridevi Night | november_reused | panel10 | 0 | 0 | 0 | 10 |
| Sridevi Night | november_reused | sp30 | 1 | 1 | 1 | 8 |
| Sridevi Night | november_reused | dp20 | 0 | 0 | 0 | 2 |
| Time Bazar | weight_train | top5 | 6 | 6 | 6 | 19 |
| Time Bazar | weight_train | avoid2 | 9 | 9 | 9 | 19 |
| Time Bazar | weight_train | panel10 | 1 | 1 | 1 | 19 |
| Time Bazar | weight_train | sp30 | 5 | 5 | 5 | 16 |
| Time Bazar | weight_train | dp20 | 1 | 1 | 1 | 3 |
| Time Bazar | weight_validation | top5 | 7 | 7 | 7 | 13 |
| Time Bazar | weight_validation | avoid2 | 6 | 6 | 6 | 13 |
| Time Bazar | weight_validation | panel10 | 2 | 2 | 2 | 13 |
| Time Bazar | weight_validation | sp30 | 5 | 5 | 5 | 12 |
| Time Bazar | weight_validation | dp20 | 1 | 1 | 1 | 1 |
| Time Bazar | late_reused | top5 | 2 | 2 | 2 | 6 |
| Time Bazar | late_reused | avoid2 | 0 | 0 | 0 | 6 |
| Time Bazar | late_reused | panel10 | 0 | 0 | 0 | 6 |
| Time Bazar | late_reused | sp30 | 2 | 2 | 2 | 5 |
| Time Bazar | late_reused | dp20 | 1 | 1 | 1 | 1 |
| Time Bazar | november_reused | top5 | 4 | 4 | 4 | 8 |
| Time Bazar | november_reused | avoid2 | 6 | 6 | 6 | 8 |
| Time Bazar | november_reused | panel10 | 0 | 0 | 0 | 8 |
| Time Bazar | november_reused | sp30 | 0 | 0 | 0 | 4 |
| Time Bazar | november_reused | dp20 | 1 | 1 | 1 | 4 |

Market-routed pipeline totals (sum separately selected market outputs):

| Block | Metric | Original selected | Pooled selected | Eligible |
|---|---|---:|---:|---:|
| weight_train | top5 | 117 | 117 | 237 |
| weight_train | avoid2 | 118 | 118 | 237 |
| weight_train | panel10 | 17 | 16 | 237 |
| weight_train | sp30 | 51 | 51 | 186 |
| weight_train | dp20 | 14 | 15 | 51 |
| weight_validation | top5 | 73 | 72 | 152 |
| weight_validation | avoid2 | 85 | 82 | 152 |
| weight_validation | panel10 | 12 | 12 | 152 |
| weight_validation | sp30 | 29 | 29 | 111 |
| weight_validation | dp20 | 10 | 10 | 41 |
| late_reused | top5 | 30 | 31 | 61 |
| late_reused | avoid2 | 33 | 34 | 61 |
| late_reused | panel10 | 4 | 4 | 61 |
| late_reused | sp30 | 13 | 13 | 46 |
| late_reused | dp20 | 4 | 4 | 14 |
| november_reused | top5 | 43 | 43 | 88 |
| november_reused | avoid2 | 43 | 46 | 88 |
| november_reused | panel10 | 5 | 5 | 88 |
| november_reused | sp30 | 15 | 14 | 66 |
| november_reused | dp20 | 5 | 5 | 21 |

The direct pooled DP expert improves fit counts but produces no later DP gain after guarded fusion. Other component counts trade off. These reused-date diagnostics do not support promotion.

The gzip ledger pooled_dp_metrics.csv.gz contains all 798 rows x 13 scopes x 5 metrics x 3 blocks (155610 records). JSON contains all six periods, component source indices, selections, full candidate metadata, input hashes, frozen routing and checks. ALL source indices reference early global selections; actual bundles use per-market routing.

Checks passed: selected source index/ID reconstruction; non-DP byte equality; supported-market DP byte equality; non-DP specialist pick equality; positive normalized distributions; exact 5/2/10/30/20 budgets; independently regenerated selected fusion hit counts on every block.
