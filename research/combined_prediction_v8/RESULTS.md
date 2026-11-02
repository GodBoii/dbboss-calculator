# Which market benefits from which approach?

The models should be evaluated market by market. The new tests found different useful leads for different markets, and several validation gains reversed later. No single approach reliably improved every output across every market. Production remains unchanged.

## What was tested

Each channel has 1,628 source model schemes: the audited V7 expert and fusion candidates plus 158 new local/pooled probability mixtures. They are parameter variants, not independent discoveries.

The study compared 103 causal controller variants and three static references for each component. Controllers can choose a different model for each market and date using only earlier dates. They include local calendar windows, recent-draw windows, pooled evidence excluding the target market, fixed day/night-group evidence, decay, uncertainty penalties and recent-regression guards.

Independent-output routing was tested alongside coherent same-source routing, where one source scheme produces all five outputs on a draw. Coherent policy selection requires each component to avoid regression on both fitting blocks. Jodi25 has 1,677 source schemes, including 49 cross-controller Open/Close approaches, and never uses the actual target Open result.

All 12 markets were evaluated separately. Policy selection uses September 8-30 and October 1-15. Later comparisons are October 16-22 and October 23-November 1. All these dates were already examined in earlier research, so they provide retrospective comparisons, not fresh confirmation.

## Two coherent market-specific leads

These policies were chosen from fitting and validation periods. Neither lost any of its five component hit counts in either later block, and both gained hits. This is an observed result on small samples, not a general accuracy guarantee.

| Market and regime | Approach | Observed outcome |
|---|---|---|
| Sridevi, Open | 30-day local evidence shrunk toward other-market evidence, prior strength 8 | Avoid-two, panels, SP and DP gained on October 23-November 1; Top-5 Sutta stayed equal. No component lost hits in the October 16-22 block either. |
| Rajdhani Night, Close before Open | 30-day local evidence shrunk toward the fixed night-market group, prior strength 8 | Top-5 Sutta and SP gained on October 23-November 1; avoid-two, panel Top-10 and DP stayed equal. No component lost hits in the preceding block. |

The exact October 23-November 1 counts are:

| Output | Sridevi Open: production to candidate | Rajdhani Night Close before Open: production to candidate |
|---|---:|---:|
| Top-5 Sutta | 5 to 5 / 10 | 2 to 5 / 6 |
| Both avoid digits absent | 7 to 9 / 10 | 0 to 0 / 6 |
| Panel Top-10 | 0 to 2 / 10 | 0 to 0 / 6 |
| SP-30 | 3 to 4 / 8 | 1 to 2 / 4 |
| DP-20 | 0 to 1 / 2 | 0 to 0 / 2 |

SP and DP denominators condition on actual panel kind. Two DP observations cannot establish a stable DP improvement. Zero-hit ties are not successful predictions. These two cases are priorities for prospective testing, not automatic live replacements.

## Other endpoint-specific leads and failures

The following are different separately selected output policies, not whole-market wins:

- Madhur Day Open Top-5 went from 4 to 9 hits out of 10 in the final block, after tying the preceding block. Open SP lost two hits, so this does not establish an overall market improvement.
- Main Bazar Open avoid-two gained two hits in the first later block and one in the final block. Its Close Top-5 policy lost hits.
- Time Bazar Open avoid-two gained three hits and then two. Its Open Top-5 policy lost two in the final block, and Close avoid-two lost three.
- Sridevi Jodi25 gained one hit in each later block. Kalyan and Kalyan Night Jodi policies reversed their validation gains instead.
- Sridevi Night Close Top-5 gained two hits in each later block, while its Open avoid-two policy lost three hits in the final block.
- Milan Night has several endpoint leads, but not enough evidence to declare every output improved.
- Madhur Night has no completed draws in either later block. It is unevaluated there, not a winner or loser.

`MARKET_DECISIONS.md` contains all 12 markets, every positive validation direction that persisted or reversed, and later losses. `REPORT.md` contains every endpoint's selected approach, all static references and all coherent companion-output comparisons. Other approaches and failed trials remain in the ledgers.

## Evidence and future use

There are 208 market/pooled endpoint policy choices and 39 coherent policy choices. The evaluation keeps per-output denominators and never adds unlike hit rates into an overall accuracy percentage. The coherent controller uses correct-output count per draw only as an internal routing utility, not as a reported accuracy rate.

Sparse-market policy selection can borrow leave-market-out validation evidence while requiring nonnegative local fitting counts. Those choices are explicitly labeled sparse transfer; they are not evidence from large local samples.

Independent verification reconstructed 474 new probability mixtures, checked 1,957 real controller routes and 88,816 paired summary cells, and tested all 103 controllers for chronological, eligibility, prefix and row-order invariance. Existing source model fitting and repeated research history remain limitations even when the new routing logic passes causality checks.

`prospective_protocol.json` freezes definitions for future evaluation. It records no future forecasts or outcomes and schedules no automation. The two priorities above were identified after inspecting reused audit results, so any new claim about them needs predictions registered before genuinely new outcomes arrive.
