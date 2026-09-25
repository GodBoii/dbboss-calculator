# Operator source and mechanism audit

**Reviewed:** 2026-09-25. This read-only review covers the chart source in `links.txt`, public betting and guessing pages linked to it, and the four local explanations named in the task.

## Finding

The public pages show historical Open/Jodi/Close records, betting interfaces, posted payout rates, and user-submitted guesses. They do not disclose how the markets in this app generate results, who sets them, whether the result setter sees all bets, or whether results are chosen to minimize payouts. No reviewed source establishes the local docs' account of operator psychology.

A timestamped outcome-level bet ledger plus the actual payout, cutoff, and settlement rules would be the strongest input for a liability model. The chart archive contains none of those. Public guessing posts are a possible measure of visible player attention, not a measure of bets.

## What the sources establish

- **Chart source.** The repo's selected [Sridevi chart URL](https://dpbossss.boston/panel-chart-record/sridevi.php) redirects to `dpboss.tax`. It labels itself as an Open Panel/Jodi/Close Panel history and shows current results and archived records. It does not document a draw procedure, the source operator, stake totals, liability calculations, an audit trail, or result revisions. Its footer gives a contact as “Astrologer-Dpboss.” This is a source for what the chart publisher displays, not how the result is selected.
- **Betting interface.** [Matka Kalyan Satta](https://matkakalyansatta.com/) lists markets, Open/Close times, Panna/Jodi products, rates, and a bid form where a user selects a session, digit or panna, and points. It describes wallet bid and win histories, but not result generation or whether its book controls the charted markets. Its About Us copy encourages continuing after losses; that is evidence of the site's retention messaging, not evidence that results are selected to bring players back.
- **Promoted calculators.** The linked publisher's [Magic Calculator page](https://dpboss.tax/dpboss-vip-magic-calculator.php) says its OTC tool takes yesterday's Jodi and applies “mathematical logic and astrology” to produce four suggested digits. The Motor Patti generator takes four or more digits and generates SP/DP combinations. It shows a current date, but I found no dated archive of generated numbers or validation results. The Motor tool is combinatorics, not a probability model.
- **Public guesses.** The [DPBoss guessing forum](https://dpboss.direct/matka-guessing-forum) accepts market-specific Open/Close, Jodi, and Panna guesses. It says to post at least ten minutes before result time. The serialized page data exposes `createdAt`, `updatedAt`, and deletion-status fields. On 2026-09-25, the paginated feed showed 13 pages at 25 posts per page; pages 1, 8, and 13 contained timestamps from 2026-09-24/25 spanning several hours. This is a shallow current feed, not a historical archive suitable for retrospective testing. Guess posts are interleaved with comments and admin result/winner posts. Site rules are not proof that each post obeyed the cutoff. A useful prospective dataset would need immutable snapshots taken before each result and filtering that excludes comments and post-result material. It still would not reveal stakes. [Posting rules](https://dpboss.direct/rules)
- **Provider guidance.** The publisher's [chart comparison article](https://dpboss.tax/blog/difference-between-kalyan-jodi-chart-and-panel-chart) describes charts as records of completed outcomes and says gaps and repeated patterns do not guarantee a later result. This is guidance about interpreting charts, not technical documentation of a draw mechanism.

Public payout tables are not consistent across sites. Matka Kalyan Satta's displayed rates correspond to 1:140 Single Panna, 1:280 Double Panna, and 1:700 Triple Panna; [Play Matka](https://playmatka.mobi/) advertises 1:140, 1:250, and 1:600. The sites may describe different services. Neither table can be treated as the payout rules for the 12 chart markets in this app.

## Correct the “uniform 220 panels” argument

[`how_the_game_works.md`](../../how_the_game_works.md) §6 and [`analysis.md`](../../analysis.md) §1 assume equal probability across 220 canonical digit-composition families. That gives 90/220 = 40.91% DP and 10/220 = 4.55% TP. No reviewed source documents a draw that selects uniformly among those 220 families.

Under a different, also unverified model where three decimal digits are drawn independently, class probabilities follow ordering multiplicities: 720/1000 SP (72%), 270/1000 DP (27%), and 10/1000 TP (1%). The two null models are not interchangeable. In the 2026 sample, the audit reports 2,464 DPs in 10,432 outcomes (23.6196%) and 16 TPs (0.1534%). With the sample's estimated digit marginals, independent draws would give 27.0025% DP and 1.0004% TP. This is evidence against that specific independent-digit model, assuming correct and complete labels. It points to non-iid panel selection or source behavior; it does not identify operator liability selection, deliberate suppression, or a psychological strategy.

## Local claims versus evidence

- `how_the_game_works.md` states as fact that the operator sees all wagers and chooses the lowest-payout result. Its triple “proof” relies on the unsupported 220-family null. The cited public chart page provides no wager ledger or draw rule.
- `analysis.md` attributes payday effects, market liquidity, drought extensions, “honey-pots,” and cross-market flows to operator intent without operator statements or stake data.
- `DP-pattern.md` reports many conditional historical patterns and assigns causal stories to some. The document itself says only one rule survived its walk-forward check weakly. Retrospective precision in a selected subgroup is not evidence of why a result occurred.
- `prediction.md` and `src/lib/predictor/operator-psychology.ts` use historical results, recent gaps, dates, market labels, and known Open results. The code assigns these hand-set heuristics names such as “regime,” “mood,” and liability adjustments; it does not read bets or measure operator psychology. `analysis.md` calls the Jodi model future work, while `prediction.md` describes it as implemented.

## Missing variables and next data source

**Direct inputs, if lawfully available:** timestamped accepted stakes by market, event, bet type, and exact outcome; effective payout/void/cutoff rules; rejected or cancelled bets; and the net liability of every candidate result. Close prediction also needs the post-Open Jodi/Ank book. A documented draw procedure or independent audit is needed to choose a defensible null model.

**Public proxies for a prospective test:**

- Freeze the guessing forum before each result. Parse the guessed panels/Jodis by market and position, then measure how much visible guess activity favors DP vs SP. Store first and later versions separately. Page metadata exposes timestamps, but the current archive is too shallow for a historical test.
- Capture timestamped public ank/panel/Jodi tips, payout-rate changes, and result-page changes before and after each event. Tip counts proxy attention, not money; result snapshots primarily help measure posting delays, edits, missing entries, and data quality.

The existing DP audit already tested market/position, weekday and calendar date, prior DP rates and gaps, same-market prior Open/Close kinds and digits, prior cross-market outcomes, and known Open for Close. Re-running those under “operator psychology” labels adds no new information. The material missing inputs are the wager book and a frozen, timestamped public-guess history.

**Conclusion:** the public material does not yield a factual operator-selection model. A prospective forum-guess signal is testable; liability selection is not directly testable from the chart history alone.
