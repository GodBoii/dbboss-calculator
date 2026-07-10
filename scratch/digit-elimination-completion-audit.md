# Digit Elimination Research Completion Audit

This audit maps the requested research brief to the scratch-only evidence produced in this thread.

No production app files were changed.

## Source Brief

Referenced prompt:

- `C:\Users\prajw\.codex\attachments\a70206d9-4540-4a41-9522-37e7df0b4d13\pasted-text-1.txt`

Core objective:

- Research whether we can predict 4 digits least likely to appear in upcoming open and close panels for each market.
- Test hypotheses rigorously.
- Reject weak models.
- Do not apply anything in the app yet.

## Evidence Files

Main final reports:

- `scratch/digit-elimination-research-report.md`
- `scratch/digit-elimination-final-summary.md`

Main experiment outputs:

- `scratch/digit-elimination-research-output.json`
- `scratch/digit-elimination-stability-output.json`
- `scratch/digit-elimination-learned-output.json`
- `scratch/digit-elimination-current-vs-learned-output.json`
- `scratch/digit-elimination-pocket-deep-output.json`
- `scratch/live-freshness-check-output.json`
- `scratch/live-holdout-milan-day-output.json`

Experiment scripts:

- `scratch/digit-elimination-research.cjs`
- `scratch/digit-elimination-stability.cjs`
- `scratch/digit-elimination-learned.cjs`
- `scratch/digit-elimination-current-vs-learned.cjs`
- `scratch/digit-elimination-pocket-deep.cjs`
- `scratch/live-freshness-check.cjs`
- `scratch/live-holdout-milan-day.cjs`
- `scratch/digit-elimination-final-summary.cjs`

## Deliverable Audit

| Requested deliverable | Status | Evidence |
| --- | --- | --- |
| Baseline elimination accuracy for every market | Complete | `digit-elimination-final-summary.md`, full market-side table, `Current` column |
| Improved elimination accuracy for every market | Complete | `digit-elimination-final-summary.md`, full market-side table, `Learned` column |
| Best-performing model for each market | Complete as routing recommendation | `Recommendation` column: research candidate, weak candidate, keep current, or no strong signal |
| Features selected for each market | Complete at model-family level | Research report sections for pattern families, learned features, and pocket tests |
| Market-specific rules and strategies | Complete as research routing | `Research Candidates`, `Weak Candidates`, and `Full Market-Side Table` |
| Average number of correctly eliminated digits | Complete | `Avg current` and `Avg learned` columns |
| Confidence score for every elimination prediction | Complete as market-side research confidence | `Confidence` column in final summary |
| Comparison table baseline vs improved | Complete | `Full Market-Side Table` |
| Analysis of hypotheses that added value | Complete | `digit-elimination-research-report.md` hypothesis verdict, learned-model, and pocket sections |
| Recommendations for future improvements | Complete | Final recommendation and practical takeaway sections |

## Final Research Result

Conservative research candidates:

| Market | Side | Learned accuracy | Edge vs current |
| --- | --- | ---: | ---: |
| Milan Night | Open | 74.7% | +2.4 pp |
| Time Bazar | Open | 74.5% | +2.1 pp |

Weak candidates:

- Time Bazar close
- Main Bazar open
- Sridevi Night close

Rejected as broad app feature:

- Global 4-digit elimination model
- Global learned replacement model
- Forced predictions for every market-side

## Completion Verdict

The research phase requested in the user objective is complete for the currently available data.

The evidence does not justify implementation yet. The correct next step is not app integration; it is collecting fresh holdout rows and re-testing the surviving research candidates.

