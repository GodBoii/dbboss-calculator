# Forward test for public DP guesses

This file fixes the evaluation plan before enough forward outcomes exist. The forum is a public-attention proxy, not the operator's wager book. No DP alert is enabled by this plan.

## Eligible event

- A `forward_snapshots.jsonl` record exists for one of the app's 12 markets and its Open or Close result.
- The snapshot has parser version 3 or later, with a chart check before and after the forum fetch confirming that the target panel was not yet published. The first 2026-09-25 Madhur Day Open snapshot predates these checks and serves only as a collection check.
- The capture finished before the script's configured result cutoff. A missed or late capture is excluded, never reconstructed from a later page.
- The chart later publishes an unambiguous three-digit panel. DP means exactly two distinct digits; SP and TP are negatives.
- At least five target-tagged guessing posts and ten recognized canonical SP/DP panel tokens were present in the captured pages. These thresholds were chosen before scoring to avoid calling on one person's post.

## Hypotheses and split

For each eligible event, compute `DP token share = dpPanelTokens / (dpPanelTokens + spPanelTokens)` from the frozen aggregate. First inspect whether actual DP rates rise or fall across predeclared share bands: below 20%, 20–39%, 40–59%, 60–79%, and 80% or more. The direction is unknown. Also compare post count and side, without assigning causal meaning.

Use the first 60 eligible **calendar dates in IST** as development, pooling their eligible markets and sides. Select at most one rule using those dates. Freeze its exact market/side scope, band, minimum support, and cutoff before the next calendar date. Evaluate only later dates as the forward test. Report every rule-eligible event, DP call, correct call, false call, and abstention.

Do not claim 90% precision until the frozen rule has at least 100 forward DP calls on at least 50 distinct dates and its one-sided 95% lower precision bound exceeds 90%. Report daily 5–10-call hit counts as a secondary measure. A few perfect days or a high development score do not promote the rule. The user has said 70–80% on some days is acceptable, but a rule still needs repeated forward evidence before any claim.

## Known limits

The forum feed can omit deleted posts, update old posts, shift during pagination, and contain non-guess numbers. The collector samples the most recent three pages and discards authors and raw text. It can miss older pre-event posts and does not measure stakes. Current market schedules are configured times, not verified publication timestamps. Chart results may be revised after initial posting. These limits must accompany any precision report.
