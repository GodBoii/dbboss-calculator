# Latent daily DP-rate test

The app's older notes suggest that an operator chooses a daily "hot" or "cold" DP mode. This test asks whether earlier results on the same day, the previous observed day's DP share, and each market/side's training rate support selective DP calls. It tests the observable consequence of the theory; it does not establish an operator's motive.

I used the cleaned 12-market chart rows, ordered each Open and Close result by the app's current schedule, and exposed only results at strictly earlier scheduled minutes to the target event. The archive does not provide actual publication times, so schedule availability remains an assumption.

Market and side base rates were fitted through 2024-12-31. The 2025 period selected from 300 parameter sets and 41 thresholds per set, 12,300 configurations. The final 2026 period was scored after selection. This is a retrospective audit because other work has already inspected 2026 data.

| Split | DP calls | Correct | Precision | Active days | Days with 5–10 calls | Such days at 70%+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025 validation | 271 | 90 | 33.2% | 30 | 5 | 0 |
| 2026 audit | 251 | 68 | 27.1% | 25 | 4 | 0 |

The 2026 rule made 31 calls across its four days with 5–10 calls and got 10 right. The latent-rate approach adds no evidence for a high-precision DP alert. See `results.json` and run `python research/dp_latent_regime_v1/run.py` to reproduce.
