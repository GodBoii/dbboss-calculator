# Two-Digit Agent Arbitration Gate

Generated: 2026-07-09T17:19:43.207Z
Aligned prediction rows: 720
Gate configs tested: 24
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: exact>=3, overlap=true, digit>=3 | 164 | 59.1% (97/164) | 1.55 |
| Best min 60 calls: exact>=3, overlap=true, digit>=3 | 164 | 59.1% (97/164) | 1.55 |

## AI-Agent Interpretation

- This simulates the practical role of an LLM/agent: compare independent model families, require agreement, and abstain when evidence conflicts.
- The agent does not invent digits. It arbitrates model evidence and enforces a call/no-call threshold.
- If agreement gates cannot clear 80%, then adding an LLM as a direct predictor is unlikely to safely beat numeric models; its best role remains audit and risk control.