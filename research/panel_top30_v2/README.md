# Exact-panel Top-30 research v2

This directory is deliberately isolated from the application and its production models.
It reads the frozen historical cache at `scratch/open-sutta-records-cache.json`, but writes
only inside this directory.

## Objective

Estimate how accurately 30 candidates can cover the exact Open panel, pre-Open Close
panel, and Close panel after the Open panel is known. There are 220 legal panel labels,
so uniform Top-30 coverage is 13.64%.

The requested target is 90%. The harness does not force or relabel that result. It reports
90% only if a chronologically untouched terminal holdout genuinely reaches it.

## Leakage controls

- Every sample feature uses results strictly earlier than its target date.
- Same-day cross-market inputs are restricted to the timing-safe source map already used
  by the repository.
- The adjusted-Close task alone receives the target day's known Open panel.
- Hyperparameters are trained before 2025-10-01, early-stopped on 2025 Q4, and selected
  on 2026 Q1.
- The terminal 2026-04-01 through cache-end block is evaluated once after selection.
- All candidate features are causal rolling counts; no full-data frequency enters a model.

## Models

- `hot`: causal long-run exact-panel frequency.
- `profile`: a fixed empirical-Bayes structural formula declared before holdout.
- `dynamic`: learned linear weights over causal candidate features.
- `additive`: regularized categorical conditional tables plus dynamic features.
- `low_rank`: low-rank categorical embeddings plus dynamic features.
- Top-30 margin-loss variants of the learned families, selected under the same protocol.
- `ensemble`: validation-selected probability blend of the strongest learned model and
  the fixed profile.

## Run

From the repository root:

```powershell
python research/panel_top30_v2/run_research.py
```

Outputs:

- `results.json`: complete metrics, selection evidence, feasibility audit, and hashes.
- `holdout_ledger.csv`: one row per holdout prediction with actual label and Top-30 set.
- `REPORT.md`: human-readable conclusions.
- `models/*.pt`: validation-selected research-only models refit on the full frozen cache.

## Extended research index

- `MASTER_REPORT.md`: consolidated outcome and current blocker.
- `EXTENDED_AUDIT.md`: 23,279-row public-chart reconciliation.
- `EXTENDED_REPORT.md`: longer-history/window experiments.
- `EVENT_SEQUENCE_REPORT.md`: actual-time 64-event GRU experiment.
- `LONG_CYCLE_REPORT.md`: 260 causal cycle/same-day rankers per side.
- `INFORMATION_CEILING_REPORT.md`: 49 conditional-context models per side and
  out-of-sample information-gain audit.

All generated data, models, ledgers, and reports stay in this directory. None is imported by
or connected to the application.
