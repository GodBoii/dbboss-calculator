# Fixed-budget panel experiments

Test 14 alternatives to the current ten-panel list for Open and Close after Open. All candidates return ten distinct legal panels. No larger shortlist, skipped draw, or retrospectively chosen market route can count as an improvement.

Use the frozen `two_year_walkforward_v1` source and comparator ledger. Outcome inputs stay within 2024-10-09 through 2026-10-08. Each target's history contains only earlier dates. Close after Open additionally receives that target's Open panel; its Close panel is used only for scoring. No network refresh or source replacement occurs in this study.

The existing panel model was trained through 2026-07-02. Select one global candidate per side on 2026-07-03 through 2026-08-31, with production winning ties. Freeze that choice for evaluation on 2026-09-01 through 2026-10-08. All these dates have appeared in earlier research. This is exploratory retrospective evaluation, not an untouched holdout or a prospective trial.

Candidate formulas, fixed before execution:

- Reserve 1, 2, or 3 slots for the highest ranked DP panels. Fill other slots with highest ranked non-DP panels.
- Restrict panels to the production Top-6 or Top-8 Sutta digits.
- Add 2, 5, or 10 panel-rank positions for each Sutta-rank position below first.
- Exclude panels containing either of the production absent-pair digits, or add a 10-rank penalty for each distinct avoided digit present. This tests exploratory candidates even when the absent-pair gate says no safe call; it does not claim that gate has passed.
- Greedily cap distinct digit overlap with every already selected panel at 2 or 1. If this cannot fill ten slots, fill remaining slots in original rank order.
- Combine the Top-6 Sutta restriction with 1 or 2 reserved DP slots.

The comparator must reproduce the saved current-code Open and live-Close Top-10 orders exactly before any result is accepted. The candidate generator receives history-derived ranks, digit lists, and avoid lists, never the target outcome. Fail on invalid, conflicting, duplicate, or out-of-scope source records, missing comparator targets, or wrong panel counts.

Save source, comparator, runtime, and experiment hashes plus every prediction and its hit. Report all candidates on selection and later evaluation, the frozen winner's paired gain/loss counts, date-clustered bootstrap intervals, per-market results, actual-kind breakdowns, and recent slices. Adjust the two frozen-winner intervals to 97.5% each for two-task family coverage; keep ordinary 95% intervals for description. Results from the later block must not choose a different candidate.

Production remains unchanged in this experiment. An apparent gain requires a later prospective trial before promotion because the hypothesis and reused evaluation dates are exploratory.
