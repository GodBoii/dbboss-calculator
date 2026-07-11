# Unified sutta ranking: exact 30-day Top-6 backtest

Generated 2026-07-11 using the production prediction path and 309 walk-forward market-days. Each prediction uses only records available before the target row.

| Market | N | Open | Close | Jodi | Adjusted Close |
|---|---:|---:|---:|---:|---:|
| Sridevi | 30 | 73.3% | 60.0% | 50.0% | 63.3% |
| Time Bazar | 26 | 80.8% | 80.8% | 73.1% | 80.8% |
| Madhur Day | 30 | 60.0% | 63.3% | 43.3% | 63.3% |
| Milan Day | 26 | 80.8% | 65.4% | 53.8% | 61.5% |
| Rajdhani Day | 26 | 76.9% | 69.2% | 50.0% | 73.1% |
| Kalyan | 26 | 73.1% | 65.4% | 53.8% | 46.2% |
| Sridevi Night | 30 | 80.0% | 66.7% | 50.0% | 70.0% |
| Kalyan Night | 19 | 63.2% | 73.7% | 42.1% | 68.4% |
| Madhur Night | 26 | 69.2% | 69.2% | 50.0% | 69.2% |
| Milan Night | 26 | 69.2% | 65.4% | 46.2% | 65.4% |
| Rajdhani Night | 22 | 77.3% | 77.3% | 59.1% | 77.3% |
| Main Bazar | 22 | 59.1% | 54.5% | 31.8% | 54.5% |
| **All markets** | **309** | **72.2%** | **67.3%** | **50.5%** | **66.0%** |

The Jodi result tests whether the actual bracket is inside the 36-way Cartesian set formed by the Top-6 Open and Top-6 Close digits. The adjusted Close result supplies the actual Open digit to the adjusted-close model, then tests its Top 6.

Raw machine-readable output: `scratch/sutta-baseline-30d-unified-ranking.json`.
