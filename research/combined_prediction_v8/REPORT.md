# V8 market-specific combinations and causal online controllers

All observations through November 1 have already been used in earlier research. These are reused retrospective results, with no fresh confirmation period. Production is unchanged.

Each market and endpoint has its own frozen approach choice using September 8–30 training and October 1–15 validation. With at least 15 eligible training and eight validation events, it requires a strict local validation gain and no local training regression. Sparse endpoints can use guarded leave-market-out transfer: no local training or validation loss, no training loss on other markets, and at least two validation net hits on other markets; ten pseudo-observations weight that other-market validation evidence. This can select an approach tied locally. The strict local reference and selection mode remain in results.json. Neither selector uses the two later blocks. Online controllers update source choices from strictly earlier dates during later blocks. Source expert choices themselves were fitted retrospectively in earlier V7 work; causal controller routing does not make that earlier source selection prospective.

The five component endpoints remain separate: five Sutta digits, two distinct absent digits, ten panels, thirty SP panels and twenty DP panels. SP/DP denominators condition on the actual panel type. Jodi25 is the Cartesian product of five Open and five Close-before-Open digits; it uses no known-Open forecast. No reported rates are averaged across endpoints or markets. The separate coherent controller optimizes a declared same-draw count utility: each correct output contributes one fifth, including zero for the nonmatching panel type. Its maximum is 0.8 because SP and DP cannot both hit. This utility selects source distributions; it is not an overall accuracy rate. All five reported endpoints still face separate training and validation nonregression gates.

Each cell gives production hits → approach hits / eligible events (paired net hits). Direction labels describe the four observed blocks, not evidence of durable future advantage. A zero net hit is a tie, and sparse conditional denominators remain visible.

`market_approach_summary.csv.gz` reports every declared approach, market, endpoint and block, including paired wins and losses. `market_approach_directions.csv` identifies which gains persisted, reversed or tied. These full ledgers include unsuccessful alternatives; the tables below show frozen choices and fixed comparison approaches.

`selected_source_usage.csv` names the actual source model or mixture used by each frozen policy, market, endpoint and block, with routed draws and eligible paired counts. `last_observed_source_choices.csv` identifies each policy's source decision on its market's last observed date; it is a historical decision, not a frozen promise to reuse that source on a future date. Probability blend parameters and five-component weights are explicit in catalogues.json.

## Frozen choices by market

### Kalyan

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 10→10/20 (+0) | 7→9/13 (+2) | 3→5/5 (+2) | 5→3/8 (-2) | validation gain reversed later |
| open | avoid2 | `local_calendar/days=14/min_support=10/penalty=0.05` | 7→9/20 (+2) | 4→7/13 (+3) | 2→2/5 (+0) | 2→4/8 (+2) | validation gain persisted or tied later |
| open | panel10 | `baseline` | 1→1/20 (+0) | 1→1/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `local_calendar/days=14/min_support=5/penalty=0.15` | 8→8/15 (+0) | 2→4/12 (+2) | 0→1/3 (+1) | 3→2/7 (-1) | validation gain reversed later |
| open | dp20 | `local_calendar/days=30/min_support=5/penalty=0.05` | 2→2/5 (+0) | 0→1/1 (+1) | 0→1/2 (+1) | 0→0/1 (+0) | validation gain persisted or tied later |
| close_pre | top5 | `shrinkage/prior=pool/days=60/strength=3/min_support=5/penalty=0.1` | 9→10/20 (+1) | 5→9/13 (+4) | 2→3/5 (+1) | 5→4/8 (-1) | validation gain reversed later |
| close_pre | avoid2 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 11→11/20 (+0) | 3→8/13 (+5) | 5→3/5 (-2) | 4→4/8 (+0) | validation gain reversed later |
| close_pre | panel10 | `baseline` | 0→0/20 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | sp30 | `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.1` | 2→4/12 (+2) | 1→2/9 (+1) | 1→2/4 (+1) | 2→3/7 (+1) | helped in every block |
| close_pre | dp20 | `shrinkage/prior=pool/days=60/strength=8/min_support=5/penalty=0.25` | 1→1/8 (+0) | 1→2/4 (+1) | 1→1/1 (+0) | 1→1/1 (+0) | validation gain persisted or tied later |
| close_known | top5 | `local_calendar/days=60/min_support=5/penalty=0.05` | 8→9/20 (+1) | 6→9/13 (+3) | 2→2/5 (+0) | 5→3/8 (-2) | validation gain reversed later |
| close_known | avoid2 | `baseline` | 9→9/20 (+0) | 10→10/13 (+0) | 3→3/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 0→3/20 (+3) | 0→1/13 (+1) | 0→0/5 (+0) | 2→1/8 (-1) | validation gain reversed later |
| close_known | sp30 | `shrinkage/prior=cluster/days=60/strength=8/min_support=5/penalty=0.25` | 3→3/12 (+0) | 3→3/9 (+0) | 0→0/4 (+0) | 1→3/7 (+2) | mixed or tied across blocks |
| close_known | dp20 | `baseline` | 2→2/8 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | unchanged throughout |
| jodi_pre | jodi25 | `local_calendar/days=30/min_support=5/penalty=0.05` | 3→7/20 (+4) | 4→6/13 (+2) | 1→1/5 (+0) | 3→2/8 (-1) | validation gain reversed later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 10→10/20 (+0) | 7→9/13 (+2) | 3→5/5 (+2) | 5→3/8 (-2) | validation gain reversed later |
| open | top5 | `static/v7_local_weights` | 10→10/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 7→12/20 (+5) | 4→5/13 (+1) | 2→0/5 (-2) | 2→4/8 (+2) | validation gain reversed later |
| open | avoid2 | `static/v7_local_weights` | 7→7/20 (+0) | 4→4/13 (+0) | 2→2/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 1→1/20 (+0) | 1→0/13 (-1) | 0→0/5 (+0) | 0→0/8 (+0) | validation loss persisted or tied later |
| open | panel10 | `static/v7_local_weights` | 1→1/20 (+0) | 1→1/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 8→2/15 (-6) | 2→3/12 (+1) | 0→1/3 (+1) | 3→0/7 (-3) | validation gain reversed later |
| open | sp30 | `static/v7_local_weights` | 8→8/15 (+0) | 2→2/12 (+0) | 0→0/3 (+0) | 3→3/7 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 2→2/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_weights` | 2→2/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_pre | top5 | `static/v7_local_specialists` | 9→11/20 (+2) | 5→6/13 (+1) | 2→3/5 (+1) | 5→5/8 (+0) | validation gain persisted or tied later |
| close_pre | top5 | `static/v7_local_weights` | 9→9/20 (+0) | 5→5/13 (+0) | 2→4/5 (+2) | 5→3/8 (-2) | mixed or tied across blocks |
| close_pre | avoid2 | `static/v7_local_specialists` | 11→11/20 (+0) | 3→4/13 (+1) | 5→5/5 (+0) | 4→4/8 (+0) | validation gain persisted or tied later |
| close_pre | avoid2 | `static/v7_local_weights` | 11→11/20 (+0) | 3→3/13 (+0) | 5→3/5 (-2) | 4→5/8 (+1) | mixed or tied across blocks |
| close_pre | panel10 | `static/v7_local_specialists` | 0→2/20 (+2) | 0→0/13 (+0) | 0→1/5 (+1) | 1→0/8 (-1) | mixed or tied across blocks |
| close_pre | panel10 | `static/v7_local_weights` | 0→0/20 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 2→6/12 (+4) | 1→1/9 (+0) | 1→1/4 (+0) | 2→2/7 (+0) | mixed or tied across blocks |
| close_pre | sp30 | `static/v7_local_weights` | 2→2/12 (+0) | 1→1/9 (+0) | 1→1/4 (+0) | 2→2/7 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 1→1/8 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 1→1/8 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 8→9/20 (+1) | 6→5/13 (-1) | 2→2/5 (+0) | 5→5/8 (+0) | validation loss persisted or tied later |
| close_known | top5 | `static/v7_local_weights` | 8→8/20 (+0) | 6→6/13 (+0) | 2→2/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 9→14/20 (+5) | 10→9/13 (-1) | 3→1/5 (-2) | 3→4/8 (+1) | validation loss reversed later |
| close_known | avoid2 | `static/v7_local_weights` | 9→9/20 (+0) | 10→10/13 (+0) | 3→3/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 0→3/20 (+3) | 0→1/13 (+1) | 0→0/5 (+0) | 2→1/8 (-1) | validation gain reversed later |
| close_known | panel10 | `static/v7_local_weights` | 0→0/20 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 3→3/12 (+0) | 3→1/9 (-2) | 0→1/4 (+1) | 1→3/7 (+2) | validation loss reversed later |
| close_known | sp30 | `static/v7_local_weights` | 3→3/12 (+0) | 3→3/9 (+0) | 0→0/4 (+0) | 1→1/7 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 2→2/8 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 2→2/8 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | unchanged throughout |

### Kalyan Night

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `shrinkage/prior=pool/days=60/strength=3/min_support=5/penalty=0.25` | 9→9/17 (+0) | 6→8/11 (+2) | 3→2/5 (-1) | 5→6/6 (+1) | validation gain reversed later |
| open | avoid2 | `baseline` | 10→10/17 (+0) | 5→5/11 (+0) | 4→4/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | sp30 | `decay/half_life=14/prior=pool/strength=8/min_support=5/penalty=0.25` | 3→3/11 (+0) | 4→4/9 (+0) | 0→0/2 (+0) | 4→4/6 (+0) | unchanged throughout |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 3→3/6 (+0) | 1→1/2 (+0) | 1→1/3 (+0) | — / 0 | incomplete eligible history |
| close_pre | top5 | `local_calendar/days=14/min_support=5/penalty=0.05` | 10→11/17 (+1) | 5→8/11 (+3) | 3→1/5 (-2) | 3→3/6 (+0) | validation gain reversed later |
| close_pre | avoid2 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.1` | 8→10/17 (+2) | 3→6/11 (+3) | 4→3/5 (-1) | 2→3/6 (+1) | validation gain reversed later |
| close_pre | panel10 | `baseline` | 2→2/17 (+0) | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_pre | sp30 | `local_calendar/days=14/min_support=10/penalty=0.05` | 5→5/13 (+0) | 2→2/9 (+0) | 1→1/4 (+0) | 1→1/5 (+0) | unchanged throughout |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | top5 | `baseline` | 6→6/17 (+0) | 7→7/11 (+0) | 3→3/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | avoid2 | `static/new_local_mixture` | 10→13/17 (+3) | 4→7/11 (+3) | 3→3/5 (+0) | 3→1/6 (-2) | validation gain reversed later |
| close_known | panel10 | `local_calendar/days=30/min_support=5/penalty=0.05` | 0→1/17 (+1) | 0→3/11 (+3) | 0→1/5 (+1) | 0→0/6 (+0) | validation gain persisted or tied later |
| close_known | sp30 | `baseline` | 4→4/13 (+0) | 5→5/9 (+0) | 2→2/4 (+0) | 3→3/5 (+0) | unchanged throughout |
| close_known | dp20 | `static/new_local_mixture` | 1→1/4 (+0) | 0→1/2 (+1) | 0→0/1 (+0) | 0→0/1 (+0) | validation gain persisted or tied later |
| jodi_pre | jodi25 | `decay/half_life=14/prior=none/strength=8/min_support=5/penalty=0.1` | 3→6/17 (+3) | 3→5/11 (+2) | 1→1/5 (+0) | 3→1/6 (-2) | validation gain reversed later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 9→5/17 (-4) | 6→7/11 (+1) | 3→3/5 (+0) | 5→5/6 (+0) | validation gain persisted or tied later |
| open | top5 | `static/v7_local_weights` | 9→9/17 (+0) | 6→6/11 (+0) | 3→3/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 10→11/17 (+1) | 5→4/11 (-1) | 4→3/5 (-1) | 5→5/6 (+0) | validation loss persisted or tied later |
| open | avoid2 | `static/v7_local_weights` | 10→10/17 (+0) | 5→5/11 (+0) | 4→4/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 1→3/6 (+2) | mixed or tied across blocks |
| open | panel10 | `static/v7_local_weights` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 3→2/11 (-1) | 4→3/9 (-1) | 0→1/2 (+1) | 4→3/6 (-1) | validation loss reversed later |
| open | sp30 | `static/v7_local_weights` | 3→3/11 (+0) | 4→4/9 (+0) | 0→0/2 (+0) | 4→4/6 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 3→3/6 (+0) | 1→1/2 (+0) | 1→1/3 (+0) | — / 0 | incomplete eligible history |
| open | dp20 | `static/v7_local_weights` | 3→3/6 (+0) | 1→1/2 (+0) | 1→1/3 (+0) | — / 0 | incomplete eligible history |
| close_pre | top5 | `static/v7_local_specialists` | 10→5/17 (-5) | 5→7/11 (+2) | 3→3/5 (+0) | 3→3/6 (+0) | validation gain persisted or tied later |
| close_pre | top5 | `static/v7_local_weights` | 10→10/17 (+0) | 5→5/11 (+0) | 3→3/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 8→9/17 (+1) | 3→4/11 (+1) | 4→3/5 (-1) | 2→4/6 (+2) | validation gain reversed later |
| close_pre | avoid2 | `static/v7_local_weights` | 8→8/17 (+0) | 3→3/11 (+0) | 4→4/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 2→0/17 (-2) | 1→0/11 (-1) | 1→0/5 (-1) | 1→0/6 (-1) | hurt in every block |
| close_pre | panel10 | `static/v7_local_weights` | 2→2/17 (+0) | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 5→3/13 (-2) | 2→3/9 (+1) | 1→0/4 (-1) | 1→2/5 (+1) | validation gain reversed later |
| close_pre | sp30 | `static/v7_local_weights` | 5→5/13 (+0) | 2→2/9 (+0) | 1→1/4 (+0) | 1→1/5 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 6→5/17 (-1) | 7→7/11 (+0) | 3→3/5 (+0) | 1→3/6 (+2) | mixed or tied across blocks |
| close_known | top5 | `static/v7_local_weights` | 6→6/17 (+0) | 7→7/11 (+0) | 3→3/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 10→9/17 (-1) | 4→6/11 (+2) | 3→5/5 (+2) | 3→3/6 (+0) | validation gain persisted or tied later |
| close_known | avoid2 | `static/v7_local_weights` | 10→10/17 (+0) | 4→4/11 (+0) | 3→3/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 0→2/17 (+2) | 0→1/11 (+1) | 0→1/5 (+1) | 0→1/6 (+1) | helped in every block |
| close_known | panel10 | `static/v7_local_weights` | 0→0/17 (+0) | 0→0/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 4→6/13 (+2) | 5→2/9 (-3) | 2→1/4 (-1) | 3→0/5 (-3) | validation loss persisted or tied later |
| close_known | sp30 | `static/v7_local_weights` | 4→4/13 (+0) | 5→5/9 (+0) | 2→2/4 (+0) | 3→3/5 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |

### Madhur Day

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_calendar/days=30/min_support=10/penalty=0.05` | 13→14/23 (+1) | 7→8/15 (+1) | 3→3/7 (+0) | 4→9/10 (+5) | validation gain persisted or tied later |
| open | avoid2 | `local_calendar/days=30/min_support=5/penalty=0.05` | 7→11/23 (+4) | 5→8/15 (+3) | 5→3/7 (-2) | 8→8/10 (+0) | validation gain reversed later |
| open | panel10 | `decay/half_life=14/prior=none/strength=8/min_support=5/penalty=0.1` | 1→1/23 (+0) | 0→1/15 (+1) | 0→0/7 (+0) | 0→0/10 (+0) | validation gain persisted or tied later |
| open | sp30 | `local_calendar/days=14/min_support=5/penalty=0.05` | 2→2/15 (+0) | 2→7/11 (+5) | 0→1/6 (+1) | 3→1/6 (-2) | validation gain reversed later |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 3→4/7 (+1) | 1→1/4 (+0) | 0→0/1 (+0) | 2→2/4 (+0) | mixed or tied across blocks |
| close_pre | top5 | `baseline` | 14→14/23 (+0) | 8→8/15 (+0) | 2→2/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 14→14/23 (+0) | 6→6/15 (+0) | 4→4/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | panel10 | `local_calendar/days=14/min_support=5/penalty=0.05` | 1→1/23 (+0) | 0→1/15 (+1) | 1→0/7 (-1) | 2→2/10 (+0) | validation gain reversed later |
| close_pre | sp30 | `local_draws/draws=20/min_support=10/penalty=0.05` | 4→4/19 (+0) | 0→3/11 (+3) | 2→0/5 (-2) | 4→2/8 (-2) | validation gain reversed later |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 1→1/4 (+0) | 1→1/4 (+0) | 1→0/2 (-1) | 0→0/1 (+0) | mixed or tied across blocks |
| close_known | top5 | `static/v7_local_specialists` | 9→13/23 (+4) | 9→11/15 (+2) | 3→3/7 (+0) | 5→6/10 (+1) | validation gain persisted or tied later |
| close_known | avoid2 | `local_calendar/days=14/min_support=5/penalty=0.3` | 16→16/23 (+0) | 8→9/15 (+1) | 4→4/7 (+0) | 6→6/10 (+0) | validation gain persisted or tied later |
| close_known | panel10 | `static/new_local_mixture` | 1→2/23 (+1) | 1→2/15 (+1) | 0→0/7 (+0) | 1→1/10 (+0) | validation gain persisted or tied later |
| close_known | sp30 | `local_calendar/days=60/min_support=5/penalty=0.05` | 9→9/19 (+0) | 3→5/11 (+2) | 2→2/5 (+0) | 1→2/8 (+1) | validation gain persisted or tied later |
| close_known | dp20 | `static/new_local_mixture` | 1→1/4 (+0) | 1→2/4 (+1) | 1→1/2 (+0) | 0→1/1 (+1) | validation gain persisted or tied later |
| jodi_pre | jodi25 | `decay/half_life=30/prior=pool/strength=8/min_support=5/penalty=0.1` | 8→8/23 (+0) | 3→5/15 (+2) | 1→2/7 (+1) | 2→1/10 (-1) | validation gain reversed later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 13→14/23 (+1) | 7→8/15 (+1) | 3→2/7 (-1) | 4→6/10 (+2) | validation gain reversed later |
| open | top5 | `static/v7_local_weights` | 13→13/23 (+0) | 7→7/15 (+0) | 3→3/7 (+0) | 4→4/10 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 7→8/23 (+1) | 5→5/15 (+0) | 5→5/7 (+0) | 8→7/10 (-1) | mixed or tied across blocks |
| open | avoid2 | `static/v7_local_weights` | 7→7/23 (+0) | 5→5/15 (+0) | 5→5/7 (+0) | 8→8/10 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 1→1/23 (+0) | 0→0/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_weights` | 1→1/23 (+0) | 0→0/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 2→2/15 (+0) | 2→2/11 (+0) | 0→1/6 (+1) | 3→4/6 (+1) | mixed or tied across blocks |
| open | sp30 | `static/v7_local_weights` | 2→2/15 (+0) | 2→2/11 (+0) | 0→0/6 (+0) | 3→3/6 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 3→3/7 (+0) | 1→1/4 (+0) | 0→0/1 (+0) | 2→2/4 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_weights` | 3→3/7 (+0) | 1→1/4 (+0) | 0→0/1 (+0) | 2→2/4 (+0) | unchanged throughout |
| close_pre | top5 | `static/v7_local_specialists` | 14→8/23 (-6) | 8→10/15 (+2) | 2→2/7 (+0) | 6→2/10 (-4) | validation gain reversed later |
| close_pre | top5 | `static/v7_local_weights` | 14→14/23 (+0) | 8→8/15 (+0) | 2→2/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 14→7/23 (-7) | 6→8/15 (+2) | 4→4/7 (+0) | 6→8/10 (+2) | validation gain persisted or tied later |
| close_pre | avoid2 | `static/v7_local_weights` | 14→14/23 (+0) | 6→6/15 (+0) | 4→4/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 1→0/23 (-1) | 0→0/15 (+0) | 1→0/7 (-1) | 2→2/10 (+0) | mixed or tied across blocks |
| close_pre | panel10 | `static/v7_local_weights` | 1→1/23 (+0) | 0→0/15 (+0) | 1→1/7 (+0) | 2→2/10 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 4→4/19 (+0) | 0→0/11 (+0) | 2→1/5 (-1) | 4→3/8 (-1) | mixed or tied across blocks |
| close_pre | sp30 | `static/v7_local_weights` | 4→4/19 (+0) | 0→0/11 (+0) | 2→2/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 9→13/23 (+4) | 9→11/15 (+2) | 3→3/7 (+0) | 5→6/10 (+1) | validation gain persisted or tied later |
| close_known | top5 | `static/v7_local_weights` | 9→9/23 (+0) | 9→9/15 (+0) | 3→3/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 16→7/23 (-9) | 8→8/15 (+0) | 4→4/7 (+0) | 6→8/10 (+2) | mixed or tied across blocks |
| close_known | avoid2 | `static/v7_local_weights` | 16→16/23 (+0) | 8→8/15 (+0) | 4→4/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 1→2/23 (+1) | 1→1/15 (+0) | 0→1/7 (+1) | 1→0/10 (-1) | mixed or tied across blocks |
| close_known | panel10 | `static/v7_local_weights` | 1→1/23 (+0) | 1→1/15 (+0) | 0→0/7 (+0) | 1→1/10 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 9→5/19 (-4) | 3→3/11 (+0) | 2→3/5 (+1) | 1→0/8 (-1) | mixed or tied across blocks |
| close_known | sp30 | `static/v7_local_weights` | 9→9/19 (+0) | 3→3/11 (+0) | 2→2/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | unchanged throughout |

### Madhur Night

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_draws/draws=10/min_support=10/penalty=0.05` | 9→11/20 (+2) | 5→7/9 (+2) | — / 0 | — / 0 | incomplete eligible history |
| open | avoid2 | `static/v7_local_specialists` | 11→11/20 (+0) | 7→8/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| open | panel10 | `baseline` | 0→0/20 (+0) | 2→2/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | sp30 | `decay/half_life=14/prior=pool/strength=8/min_support=5/penalty=0.25` | 2→2/12 (+0) | 3→3/5 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | dp20 | `baseline` | 3→3/8 (+0) | 0→0/4 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | top5 | `local_calendar/days=14/min_support=5/penalty=0.3` | 8→12/20 (+4) | 3→6/9 (+3) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | avoid2 | `local_draws/draws=10/min_support=5/penalty=0.3` | 15→15/20 (+0) | 4→5/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | panel10 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.1` | 1→3/20 (+2) | 0→2/9 (+2) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | sp30 | `local_calendar/days=14/min_support=10/penalty=0.05` | 4→4/11 (+0) | 1→1/8 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 4→4/9 (+0) | 0→0/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | top5 | `empirical_bernstein/days=30/min_support=15/penalty=0.1` | 13→14/20 (+1) | 4→6/9 (+2) | — / 0 | — / 0 | incomplete eligible history |
| close_known | avoid2 | `local_calendar/days=14/min_support=10/penalty=0.05` | 12→14/20 (+2) | 5→6/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_known | panel10 | `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.25` | 2→2/20 (+0) | 0→1/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_known | sp30 | `shrinkage/prior=cluster/days=60/strength=8/min_support=5/penalty=0.25` | 2→3/11 (+1) | 1→2/8 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_known | dp20 | `baseline` | 3→3/9 (+0) | 1→1/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
| jodi_pre | jodi25 | `baseline` | 4→4/20 (+0) | 2→2/9 (+0) | — / 0 | — / 0 | incomplete eligible history |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 9→8/20 (-1) | 5→3/9 (-2) | — / 0 | — / 0 | incomplete eligible history |
| open | top5 | `static/v7_local_weights` | 9→9/20 (+0) | 5→5/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | avoid2 | `static/v7_local_specialists` | 11→11/20 (+0) | 7→8/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| open | avoid2 | `static/v7_local_weights` | 11→11/20 (+0) | 7→7/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | panel10 | `static/v7_local_specialists` | 0→2/20 (+2) | 2→1/9 (-1) | — / 0 | — / 0 | incomplete eligible history |
| open | panel10 | `static/v7_local_weights` | 0→0/20 (+0) | 2→2/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | sp30 | `static/v7_local_specialists` | 2→4/12 (+2) | 3→3/5 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | sp30 | `static/v7_local_weights` | 2→2/12 (+0) | 3→3/5 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | dp20 | `static/v7_local_specialists` | 3→3/8 (+0) | 0→0/4 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | dp20 | `static/v7_local_weights` | 3→3/8 (+0) | 0→0/4 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | top5 | `static/v7_local_specialists` | 8→12/20 (+4) | 3→4/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | top5 | `static/v7_local_weights` | 8→8/20 (+0) | 3→3/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | avoid2 | `static/v7_local_specialists` | 15→13/20 (-2) | 4→4/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | avoid2 | `static/v7_local_weights` | 15→15/20 (+0) | 4→4/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | panel10 | `static/v7_local_specialists` | 1→0/20 (-1) | 0→4/9 (+4) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | panel10 | `static/v7_local_weights` | 1→1/20 (+0) | 0→0/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | sp30 | `static/v7_local_specialists` | 4→5/11 (+1) | 1→2/8 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | sp30 | `static/v7_local_weights` | 4→4/11 (+0) | 1→1/8 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_specialists` | 4→4/9 (+0) | 0→0/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_weights` | 4→4/9 (+0) | 0→0/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | top5 | `static/v7_local_specialists` | 13→6/20 (-7) | 4→5/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_known | top5 | `static/v7_local_weights` | 13→13/20 (+0) | 4→4/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | avoid2 | `static/v7_local_specialists` | 12→9/20 (-3) | 5→2/9 (-3) | — / 0 | — / 0 | incomplete eligible history |
| close_known | avoid2 | `static/v7_local_weights` | 12→12/20 (+0) | 5→5/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | panel10 | `static/v7_local_specialists` | 2→2/20 (+0) | 0→0/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | panel10 | `static/v7_local_weights` | 2→2/20 (+0) | 0→0/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | sp30 | `static/v7_local_specialists` | 2→2/11 (+0) | 1→3/8 (+2) | — / 0 | — / 0 | incomplete eligible history |
| close_known | sp30 | `static/v7_local_weights` | 2→2/11 (+0) | 1→1/8 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | dp20 | `static/v7_local_specialists` | 3→3/9 (+0) | 1→1/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | dp20 | `static/v7_local_weights` | 3→3/9 (+0) | 1→1/1 (+0) | — / 0 | — / 0 | incomplete eligible history |

### Main Bazar

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 10→10/17 (+0) | 7→7/11 (+0) | 4→4/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 3→8/17 (+5) | 2→7/11 (+5) | 2→4/5 (+2) | 3→4/6 (+1) | helped in every block |
| open | panel10 | `local_calendar/days=14/min_support=5/penalty=0.05` | 0→1/17 (+1) | 0→2/11 (+2) | 1→1/5 (+0) | 0→0/6 (+0) | validation gain persisted or tied later |
| open | sp30 | `baseline` | 1→1/13 (+0) | 0→0/9 (+0) | 1→1/5 (+0) | 0→0/4 (+0) | unchanged throughout |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 0→0/4 (+0) | 1→1/2 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `decay/half_life=14/prior=none/strength=8/min_support=5/penalty=0.1` | 7→8/17 (+1) | 5→6/11 (+1) | 4→2/5 (-2) | 4→3/6 (-1) | validation gain reversed later |
| close_pre | avoid2 | `decay/half_life=30/prior=cluster/strength=8/min_support=5/penalty=0.1` | 9→10/17 (+1) | 7→9/11 (+2) | 4→4/5 (+0) | 2→4/6 (+2) | validation gain persisted or tied later |
| close_pre | panel10 | `baseline` | 0→0/17 (+0) | 2→2/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | sp30 | `local_calendar/days=14/min_support=10/penalty=0.05` | 1→1/14 (+0) | 4→4/7 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 0→0/3 (+0) | 0→1/4 (+1) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
| close_known | top5 | `baseline` | 10→10/17 (+0) | 6→6/11 (+0) | 1→1/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 9→10/17 (+1) | 5→6/11 (+1) | 3→3/5 (+0) | 3→3/6 (+0) | validation gain persisted or tied later |
| close_known | panel10 | `baseline` | 0→0/17 (+0) | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | sp30 | `shrinkage/prior=cluster/days=60/strength=8/min_support=5/penalty=0.25` | 5→5/14 (+0) | 1→1/7 (+0) | 1→1/4 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
| jodi_pre | jodi25 | `local_calendar/days=14/min_support=10/penalty=0.05` | 5→6/17 (+1) | 2→3/11 (+1) | 3→1/5 (-2) | 1→1/6 (+0) | validation gain reversed later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 10→6/17 (-4) | 7→6/11 (-1) | 4→1/5 (-3) | 2→3/6 (+1) | validation loss reversed later |
| open | top5 | `static/v7_local_weights` | 10→10/17 (+0) | 7→7/11 (+0) | 4→3/5 (-1) | 2→1/6 (-1) | mixed or tied across blocks |
| open | avoid2 | `static/v7_local_specialists` | 3→8/17 (+5) | 2→7/11 (+5) | 2→4/5 (+2) | 3→4/6 (+1) | helped in every block |
| open | avoid2 | `static/v7_local_weights` | 3→3/17 (+0) | 2→2/11 (+0) | 2→4/5 (+2) | 3→4/6 (+1) | mixed or tied across blocks |
| open | panel10 | `static/v7_local_specialists` | 0→0/17 (+0) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_weights` | 0→0/17 (+0) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 1→5/13 (+4) | 0→2/9 (+2) | 1→2/5 (+1) | 0→0/4 (+0) | validation gain persisted or tied later |
| open | sp30 | `static/v7_local_weights` | 1→1/13 (+0) | 0→0/9 (+0) | 1→2/5 (+1) | 0→0/4 (+0) | mixed or tied across blocks |
| open | dp20 | `static/v7_local_specialists` | 0→0/4 (+0) | 1→1/2 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| open | dp20 | `static/v7_local_weights` | 0→0/4 (+0) | 1→1/2 (+0) | — / 0 | 1→0/2 (-1) | incomplete eligible history |
| close_pre | top5 | `static/v7_local_specialists` | 7→6/17 (-1) | 5→6/11 (+1) | 4→3/5 (-1) | 4→3/6 (-1) | validation gain reversed later |
| close_pre | top5 | `static/v7_local_weights` | 7→7/17 (+0) | 5→5/11 (+0) | 4→3/5 (-1) | 4→4/6 (+0) | mixed or tied across blocks |
| close_pre | avoid2 | `static/v7_local_specialists` | 9→8/17 (-1) | 7→5/11 (-2) | 4→2/5 (-2) | 2→2/6 (+0) | validation loss persisted or tied later |
| close_pre | avoid2 | `static/v7_local_weights` | 9→9/17 (+0) | 7→7/11 (+0) | 4→2/5 (-2) | 2→1/6 (-1) | mixed or tied across blocks |
| close_pre | panel10 | `static/v7_local_specialists` | 0→0/17 (+0) | 2→0/11 (-2) | 0→0/5 (+0) | 0→1/6 (+1) | validation loss reversed later |
| close_pre | panel10 | `static/v7_local_weights` | 0→0/17 (+0) | 2→2/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 1→1/14 (+0) | 4→2/7 (-2) | 1→1/4 (+0) | 1→3/6 (+2) | validation loss reversed later |
| close_pre | sp30 | `static/v7_local_weights` | 1→1/14 (+0) | 4→4/7 (+0) | 1→1/4 (+0) | 1→2/6 (+1) | mixed or tied across blocks |
| close_pre | dp20 | `static/v7_local_specialists` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_weights` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
| close_known | top5 | `static/v7_local_specialists` | 10→8/17 (-2) | 6→3/11 (-3) | 1→2/5 (+1) | 3→3/6 (+0) | validation loss reversed later |
| close_known | top5 | `static/v7_local_weights` | 10→10/17 (+0) | 6→6/11 (+0) | 1→1/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 9→10/17 (+1) | 5→6/11 (+1) | 3→3/5 (+0) | 3→3/6 (+0) | validation gain persisted or tied later |
| close_known | avoid2 | `static/v7_local_weights` | 9→9/17 (+0) | 5→5/11 (+0) | 3→3/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 0→0/17 (+0) | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_weights` | 0→0/17 (+0) | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 5→6/14 (+1) | 1→1/7 (+0) | 1→1/4 (+0) | 2→2/6 (+0) | mixed or tied across blocks |
| close_known | sp30 | `static/v7_local_weights` | 5→5/14 (+0) | 1→1/7 (+0) | 1→1/4 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
| close_known | dp20 | `static/v7_local_weights` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |

### Milan Day

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 11→11/19 (+0) | 8→9/13 (+1) | 2→2/5 (+0) | 3→3/8 (+0) | validation gain persisted or tied later |
| open | avoid2 | `baseline` | 9→9/19 (+0) | 9→9/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 0→0/19 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `shrinkage/prior=cluster/days=30/strength=16/min_support=5/penalty=0.25` | 2→2/14 (+0) | 3→3/9 (+0) | 0→0/2 (+0) | 1→1/7 (+0) | unchanged throughout |
| open | dp20 | `local_calendar/days=30/min_support=5/penalty=0.05` | 1→1/4 (+0) | 0→1/4 (+1) | 2→0/3 (-2) | 0→0/1 (+0) | validation gain reversed later |
| close_pre | top5 | `local_calendar/days=60/min_support=5/penalty=0.05` | 6→11/19 (+5) | 7→8/13 (+1) | 3→2/5 (-1) | 6→6/8 (+0) | validation gain reversed later |
| close_pre | avoid2 | `static/new_local_mixture` | 6→9/19 (+3) | 9→10/13 (+1) | 3→3/5 (+0) | 4→5/8 (+1) | validation gain persisted or tied later |
| close_pre | panel10 | `baseline` | 2→2/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | sp30 | `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.1` | 2→2/17 (+0) | 1→1/5 (+0) | — / 0 | 1→0/4 (-1) | incomplete eligible history |
| close_pre | dp20 | `shrinkage/prior=pool/days=60/strength=8/min_support=5/penalty=0.25` | 0→0/2 (+0) | 1→2/8 (+1) | 1→2/5 (+1) | 1→0/4 (-1) | validation gain reversed later |
| close_known | top5 | `static/v7_local_specialists` | 10→11/19 (+1) | 4→5/13 (+1) | 4→4/5 (+0) | 6→6/8 (+0) | validation gain persisted or tied later |
| close_known | avoid2 | `static/v7_local_specialists` | 9→10/19 (+1) | 8→10/13 (+2) | 3→3/5 (+0) | 4→3/8 (-1) | validation gain reversed later |
| close_known | panel10 | `baseline` | 3→3/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `shrinkage/prior=cluster/days=60/strength=8/min_support=5/penalty=0.25` | 7→7/17 (+0) | 0→0/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_known | dp20 | `static/new_local_mixture` | 0→0/2 (+0) | 1→2/8 (+1) | 1→0/5 (-1) | 1→0/4 (-1) | validation gain reversed later |
| jodi_pre | jodi25 | `baseline` | 2→2/19 (+0) | 6→6/13 (+0) | 1→1/5 (+0) | 3→3/8 (+0) | unchanged throughout |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 11→11/19 (+0) | 8→4/13 (-4) | 2→2/5 (+0) | 3→4/8 (+1) | validation loss reversed later |
| open | top5 | `static/v7_local_weights` | 11→11/19 (+0) | 8→8/13 (+0) | 2→2/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 9→11/19 (+2) | 9→7/13 (-2) | 3→1/5 (-2) | 5→2/8 (-3) | validation loss persisted or tied later |
| open | avoid2 | `static/v7_local_weights` | 9→9/19 (+0) | 9→9/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 0→0/19 (+0) | 2→1/13 (-1) | 0→0/5 (+0) | 0→1/8 (+1) | validation loss reversed later |
| open | panel10 | `static/v7_local_weights` | 0→0/19 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 2→1/14 (-1) | 3→2/9 (-1) | 0→0/2 (+0) | 1→3/7 (+2) | validation loss reversed later |
| open | sp30 | `static/v7_local_weights` | 2→2/14 (+0) | 3→3/9 (+0) | 0→0/2 (+0) | 1→1/7 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 0→0/4 (+0) | 2→2/3 (+0) | 0→0/1 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 0→0/4 (+0) | 2→2/3 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_pre | top5 | `static/v7_local_specialists` | 6→9/19 (+3) | 7→3/13 (-4) | 3→3/5 (+0) | 6→4/8 (-2) | validation loss persisted or tied later |
| close_pre | top5 | `static/v7_local_weights` | 6→6/19 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 6→6/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 6→2/19 (-4) | 9→10/13 (+1) | 3→4/5 (+1) | 4→5/8 (+1) | validation gain persisted or tied later |
| close_pre | avoid2 | `static/v7_local_weights` | 6→6/19 (+0) | 9→9/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 2→1/19 (-1) | 0→0/13 (+0) | 0→0/5 (+0) | 1→0/8 (-1) | mixed or tied across blocks |
| close_pre | panel10 | `static/v7_local_weights` | 2→2/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 2→4/17 (+2) | 1→1/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_pre | sp30 | `static/v7_local_weights` | 2→2/17 (+0) | 1→1/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_specialists` | 0→0/2 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 0→0/2 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 10→11/19 (+1) | 4→5/13 (+1) | 4→4/5 (+0) | 6→6/8 (+0) | validation gain persisted or tied later |
| close_known | top5 | `static/v7_local_weights` | 10→10/19 (+0) | 4→4/13 (+0) | 4→4/5 (+0) | 6→6/8 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 9→10/19 (+1) | 8→10/13 (+2) | 3→3/5 (+0) | 4→3/8 (-1) | validation gain reversed later |
| close_known | avoid2 | `static/v7_local_weights` | 9→9/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 3→1/19 (-2) | 0→0/13 (+0) | 0→0/5 (+0) | 1→0/8 (-1) | mixed or tied across blocks |
| close_known | panel10 | `static/v7_local_weights` | 3→3/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 7→4/17 (-3) | 0→0/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_known | sp30 | `static/v7_local_weights` | 7→7/17 (+0) | 0→0/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_known | dp20 | `static/v7_local_specialists` | 0→0/2 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 0→0/2 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) | unchanged throughout |

### Milan Night

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `empirical_bernstein/days=30/min_support=15/penalty=0.1` | 6→8/19 (+2) | 8→10/13 (+2) | 3→4/5 (+1) | 3→4/8 (+1) | helped in every block |
| open | avoid2 | `baseline` | 6→6/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/19 (+0) | 3→3/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 2→2/16 (+0) | 6→6/12 (+0) | 0→0/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 1→1/3 (+0) | 0→0/1 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `baseline` | 13→13/19 (+0) | 7→7/13 (+0) | 2→2/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `shrinkage/prior=cluster/days=30/strength=16/min_support=5/penalty=0.25` | 9→9/19 (+0) | 7→9/13 (+2) | 3→2/5 (-1) | 4→5/8 (+1) | validation gain reversed later |
| close_pre | panel10 | `static/v7_local_specialists` | 0→1/19 (+1) | 0→1/13 (+1) | 0→1/5 (+1) | 0→0/8 (+0) | validation gain persisted or tied later |
| close_pre | sp30 | `local_calendar/days=30/min_support=5/penalty=0.05` | 3→5/19 (+2) | 1→3/8 (+2) | 1→1/4 (+0) | 1→2/6 (+1) | validation gain persisted or tied later |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | — / 0 | 1→1/5 (+0) | 0→0/1 (+0) | 1→1/2 (+0) | incomplete eligible history |
| close_known | top5 | `baseline` | 13→13/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 7→7/8 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 10→10/19 (+0) | 6→6/13 (+0) | 4→4/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 7→7/19 (+0) | 3→3/8 (+0) | 1→1/4 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | dp20 | `static/new_local_mixture` | — / 0 | 0→1/5 (+1) | 0→1/1 (+1) | 0→0/2 (+0) | incomplete eligible history |
| jodi_pre | jodi25 | `baseline` | 6→6/19 (+0) | 4→4/13 (+0) | 1→1/5 (+0) | 3→3/8 (+0) | unchanged throughout |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 6→8/19 (+2) | 8→2/13 (-6) | 3→3/5 (+0) | 3→6/8 (+3) | validation loss reversed later |
| open | top5 | `static/v7_local_weights` | 6→6/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 6→5/19 (-1) | 8→9/13 (+1) | 3→3/5 (+0) | 2→4/8 (+2) | validation gain persisted or tied later |
| open | avoid2 | `static/v7_local_weights` | 6→6/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 1→0/19 (-1) | 3→0/13 (-3) | 0→0/5 (+0) | 1→0/8 (-1) | validation loss persisted or tied later |
| open | panel10 | `static/v7_local_weights` | 1→1/19 (+0) | 3→3/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 2→2/16 (+0) | 6→1/12 (-5) | 0→1/5 (+1) | 2→1/6 (-1) | validation loss reversed later |
| open | sp30 | `static/v7_local_weights` | 2→2/16 (+0) | 6→6/12 (+0) | 0→0/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 1→1/3 (+0) | 0→0/1 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| open | dp20 | `static/v7_local_weights` | 1→1/3 (+0) | 0→0/1 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `static/v7_local_specialists` | 13→10/19 (-3) | 7→4/13 (-3) | 2→0/5 (-2) | 4→5/8 (+1) | validation loss reversed later |
| close_pre | top5 | `static/v7_local_weights` | 13→13/19 (+0) | 7→7/13 (+0) | 2→2/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 9→7/19 (-2) | 7→4/13 (-3) | 3→3/5 (+0) | 4→6/8 (+2) | validation loss reversed later |
| close_pre | avoid2 | `static/v7_local_weights` | 9→9/19 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 0→1/19 (+1) | 0→1/13 (+1) | 0→1/5 (+1) | 0→0/8 (+0) | validation gain persisted or tied later |
| close_pre | panel10 | `static/v7_local_weights` | 0→0/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 3→4/19 (+1) | 1→2/8 (+1) | 1→2/4 (+1) | 1→4/6 (+3) | helped in every block |
| close_pre | sp30 | `static/v7_local_weights` | 3→3/19 (+0) | 1→1/8 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | — / 0 | 1→1/5 (+0) | 0→0/1 (+0) | 1→1/2 (+0) | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_weights` | — / 0 | 1→1/5 (+0) | 0→0/1 (+0) | 1→1/2 (+0) | incomplete eligible history |
| close_known | top5 | `static/v7_local_specialists` | 13→14/19 (+1) | 8→8/13 (+0) | 3→3/5 (+0) | 7→7/8 (+0) | mixed or tied across blocks |
| close_known | top5 | `static/v7_local_weights` | 13→13/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 7→7/8 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 10→10/19 (+0) | 6→6/13 (+0) | 4→2/5 (-2) | 4→4/8 (+0) | mixed or tied across blocks |
| close_known | avoid2 | `static/v7_local_weights` | 10→10/19 (+0) | 6→6/13 (+0) | 4→4/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 1→0/19 (-1) | 2→1/13 (-1) | 0→0/5 (+0) | 1→0/8 (-1) | validation loss persisted or tied later |
| close_known | panel10 | `static/v7_local_weights` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 7→2/19 (-5) | 3→1/8 (-2) | 1→0/4 (-1) | 0→1/6 (+1) | validation loss reversed later |
| close_known | sp30 | `static/v7_local_weights` | 7→7/19 (+0) | 3→3/8 (+0) | 1→1/4 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | — / 0 | 0→0/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | incomplete eligible history |
| close_known | dp20 | `static/v7_local_weights` | — / 0 | 0→0/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | incomplete eligible history |

### Rajdhani Day

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 12→12/20 (+0) | 7→7/13 (+0) | 2→2/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `local_calendar/days=30/min_support=5/penalty=0.05` | 5→8/20 (+3) | 5→9/13 (+4) | 2→3/5 (+1) | 6→4/8 (-2) | validation gain reversed later |
| open | panel10 | `baseline` | 1→1/20 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 5→5/16 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | dp20 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 1→1/4 (+0) | 0→1/5 (+1) | — / 0 | 1→0/2 (-1) | incomplete eligible history |
| close_pre | top5 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.25` | 7→10/20 (+3) | 7→9/13 (+2) | 3→3/5 (+0) | 4→3/8 (-1) | validation gain reversed later |
| close_pre | avoid2 | `baseline` | 10→10/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 2→2/20 (+0) | 3→3/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `local_calendar/days=14/min_support=10/penalty=0.05` | 6→6/13 (+0) | 5→5/11 (+0) | 2→2/4 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | dp20 | `shrinkage/prior=pool/days=60/strength=8/min_support=5/penalty=0.25` | 3→3/7 (+0) | 0→0/2 (+0) | 0→1/1 (+1) | 0→0/2 (+0) | mixed or tied across blocks |
| close_known | top5 | `baseline` | 11→11/20 (+0) | 8→8/13 (+0) | 5→5/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | avoid2 | `decay/half_life=7/prior=cluster/strength=8/min_support=5/penalty=0.1` | 8→12/20 (+4) | 7→8/13 (+1) | 3→2/5 (-1) | 2→5/8 (+3) | validation gain reversed later |
| close_known | panel10 | `decay/half_life=7/prior=cluster/strength=8/min_support=5/penalty=0.1` | 5→5/20 (+0) | 0→1/13 (+1) | 2→0/5 (-2) | 1→1/8 (+0) | validation gain reversed later |
| close_known | sp30 | `baseline` | 1→1/13 (+0) | 4→4/11 (+0) | 2→2/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | dp20 | `static/new_local_mixture` | 4→4/7 (+0) | 0→1/2 (+1) | 0→1/1 (+1) | 0→1/2 (+1) | validation gain persisted or tied later |
| jodi_pre | jodi25 | `local_draws/draws=20/min_support=10/penalty=0.05` | 4→5/20 (+1) | 3→4/13 (+1) | 1→0/5 (-1) | 1→3/8 (+2) | validation gain reversed later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 12→11/20 (-1) | 7→7/13 (+0) | 2→1/5 (-1) | 3→4/8 (+1) | mixed or tied across blocks |
| open | top5 | `static/v7_local_weights` | 12→12/20 (+0) | 7→7/13 (+0) | 2→2/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 5→8/20 (+3) | 5→6/13 (+1) | 2→3/5 (+1) | 6→5/8 (-1) | validation gain reversed later |
| open | avoid2 | `static/v7_local_weights` | 5→5/20 (+0) | 5→5/13 (+0) | 2→2/5 (+0) | 6→6/8 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 1→1/20 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_weights` | 1→1/20 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 5→4/16 (-1) | 1→1/8 (+0) | 1→1/5 (+0) | 1→2/6 (+1) | mixed or tied across blocks |
| open | sp30 | `static/v7_local_weights` | 5→5/16 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 0→0/5 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| open | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 0→0/5 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `static/v7_local_specialists` | 7→12/20 (+5) | 7→5/13 (-2) | 3→3/5 (+0) | 4→3/8 (-1) | validation loss persisted or tied later |
| close_pre | top5 | `static/v7_local_weights` | 7→7/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 10→11/20 (+1) | 7→7/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | mixed or tied across blocks |
| close_pre | avoid2 | `static/v7_local_weights` | 10→10/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 2→2/20 (+0) | 3→1/13 (-2) | 0→1/5 (+1) | 0→1/8 (+1) | validation loss reversed later |
| close_pre | panel10 | `static/v7_local_weights` | 2→2/20 (+0) | 3→3/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 6→5/13 (-1) | 5→4/11 (-1) | 2→0/4 (-2) | 0→4/6 (+4) | validation loss reversed later |
| close_pre | sp30 | `static/v7_local_weights` | 6→6/13 (+0) | 5→5/11 (+0) | 2→2/4 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 3→3/7 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 3→3/7 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 11→12/20 (+1) | 8→6/13 (-2) | 5→0/5 (-5) | 1→5/8 (+4) | validation loss reversed later |
| close_known | top5 | `static/v7_local_weights` | 11→11/20 (+0) | 8→8/13 (+0) | 5→5/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 8→11/20 (+3) | 7→7/13 (+0) | 3→2/5 (-1) | 2→2/8 (+0) | mixed or tied across blocks |
| close_known | avoid2 | `static/v7_local_weights` | 8→8/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 5→1/20 (-4) | 0→0/13 (+0) | 2→1/5 (-1) | 1→0/8 (-1) | mixed or tied across blocks |
| close_known | panel10 | `static/v7_local_weights` | 5→5/20 (+0) | 0→0/13 (+0) | 2→2/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 1→3/13 (+2) | 4→3/11 (-1) | 2→1/4 (-1) | 1→3/6 (+2) | validation loss reversed later |
| close_known | sp30 | `static/v7_local_weights` | 1→1/13 (+0) | 4→4/11 (+0) | 2→2/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 4→4/7 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 4→4/7 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |

### Rajdhani Night

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_calendar/days=14/min_support=5/penalty=0.05` | 12→12/17 (+0) | 3→6/11 (+3) | 3→2/5 (-1) | 2→3/6 (+1) | validation gain reversed later |
| open | avoid2 | `static/new_local_mixture` | 7→9/17 (+2) | 7→8/11 (+1) | 3→3/5 (+0) | 2→2/6 (+0) | validation gain persisted or tied later |
| open | panel10 | `baseline` | 1→1/17 (+0) | 1→1/11 (+0) | 2→2/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | sp30 | `decay/half_life=14/prior=pool/strength=8/min_support=5/penalty=0.25` | 4→4/9 (+0) | 4→4/8 (+0) | 2→2/5 (+0) | 0→0/5 (+0) | unchanged throughout |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 3→3/8 (+0) | 1→1/3 (+0) | — / 0 | 0→0/1 (+0) | incomplete eligible history |
| close_pre | top5 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 12→12/17 (+0) | 2→6/11 (+4) | 2→4/5 (+2) | 2→5/6 (+3) | validation gain persisted or tied later |
| close_pre | avoid2 | `empirical_bernstein/days=60/min_support=8/penalty=0.1` | 8→9/17 (+1) | 8→10/11 (+2) | 3→4/5 (+1) | 0→0/6 (+0) | validation gain persisted or tied later |
| close_pre | panel10 | `baseline` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | sp30 | `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.1` | 5→6/15 (+1) | 2→4/9 (+2) | 0→2/4 (+2) | 1→0/4 (-1) | validation gain reversed later |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 0→0/2 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_known | top5 | `baseline` | 7→7/17 (+0) | 7→7/11 (+0) | 5→5/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_known | avoid2 | `local_calendar/days=14/min_support=5/penalty=0.05` | 10→10/17 (+0) | 5→7/11 (+2) | 2→0/5 (-2) | 5→4/6 (-1) | validation gain reversed later |
| close_known | panel10 | `baseline` | 3→3/17 (+0) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 2→2/15 (+0) | 3→3/9 (+0) | 2→2/4 (+0) | 2→2/4 (+0) | unchanged throughout |
| close_known | dp20 | `static/new_local_mixture` | 0→0/2 (+0) | 0→1/2 (+1) | 0→0/1 (+0) | 0→1/2 (+1) | validation gain persisted or tied later |
| jodi_pre | jodi25 | `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.25` | 9→9/17 (+0) | 0→3/11 (+3) | 1→0/5 (-1) | 2→2/6 (+0) | validation gain reversed later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 12→12/17 (+0) | 3→6/11 (+3) | 3→2/5 (-1) | 2→3/6 (+1) | validation gain reversed later |
| open | top5 | `static/v7_local_weights` | 12→12/17 (+0) | 3→3/11 (+0) | 3→3/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 7→11/17 (+4) | 7→6/11 (-1) | 3→4/5 (+1) | 2→4/6 (+2) | validation loss reversed later |
| open | avoid2 | `static/v7_local_weights` | 7→7/17 (+0) | 7→7/11 (+0) | 3→3/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 1→1/17 (+0) | 1→1/11 (+0) | 2→2/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_weights` | 1→1/17 (+0) | 1→1/11 (+0) | 2→2/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 4→5/9 (+1) | 4→5/8 (+1) | 2→2/5 (+0) | 0→0/5 (+0) | validation gain persisted or tied later |
| open | sp30 | `static/v7_local_weights` | 4→4/9 (+0) | 4→4/8 (+0) | 2→2/5 (+0) | 0→0/5 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 3→3/8 (+0) | 1→1/3 (+0) | — / 0 | 0→0/1 (+0) | incomplete eligible history |
| open | dp20 | `static/v7_local_weights` | 3→3/8 (+0) | 1→1/3 (+0) | — / 0 | 0→0/1 (+0) | incomplete eligible history |
| close_pre | top5 | `static/v7_local_specialists` | 12→10/17 (-2) | 2→3/11 (+1) | 2→3/5 (+1) | 2→1/6 (-1) | validation gain reversed later |
| close_pre | top5 | `static/v7_local_weights` | 12→12/17 (+0) | 2→2/11 (+0) | 2→2/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 8→6/17 (-2) | 8→6/11 (-2) | 3→3/5 (+0) | 0→2/6 (+2) | validation loss reversed later |
| close_pre | avoid2 | `static/v7_local_weights` | 8→8/17 (+0) | 8→8/11 (+0) | 3→3/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 1→2/17 (+1) | 1→0/11 (-1) | 0→1/5 (+1) | 0→0/6 (+0) | validation loss reversed later |
| close_pre | panel10 | `static/v7_local_weights` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 5→3/15 (-2) | 2→1/9 (-1) | 0→1/4 (+1) | 1→0/4 (-1) | validation loss reversed later |
| close_pre | sp30 | `static/v7_local_weights` | 5→5/15 (+0) | 2→2/9 (+0) | 0→0/4 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 0→0/2 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 0→0/2 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 7→8/17 (+1) | 7→7/11 (+0) | 5→4/5 (-1) | 2→2/6 (+0) | mixed or tied across blocks |
| close_known | top5 | `static/v7_local_weights` | 7→7/17 (+0) | 7→7/11 (+0) | 5→5/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 10→9/17 (-1) | 5→6/11 (+1) | 2→3/5 (+1) | 5→4/6 (-1) | validation gain reversed later |
| close_known | avoid2 | `static/v7_local_weights` | 10→10/17 (+0) | 5→5/11 (+0) | 2→2/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 3→2/17 (-1) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | mixed or tied across blocks |
| close_known | panel10 | `static/v7_local_weights` | 3→3/17 (+0) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 2→1/15 (-1) | 3→3/9 (+0) | 2→1/4 (-1) | 2→1/4 (-1) | mixed or tied across blocks |
| close_known | sp30 | `static/v7_local_weights` | 2→2/15 (+0) | 3→3/9 (+0) | 2→2/4 (+0) | 2→2/4 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 0→0/2 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 0→0/2 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |

### Sridevi

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_calendar/days=30/min_support=5/penalty=0.05` | 14→14/23 (+0) | 7→8/15 (+1) | 3→3/7 (+0) | 5→4/10 (-1) | validation gain reversed later |
| open | avoid2 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 13→16/23 (+3) | 6→8/15 (+2) | 3→3/7 (+0) | 7→8/10 (+1) | validation gain persisted or tied later |
| open | panel10 | `baseline` | 4→4/23 (+0) | 1→1/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| open | sp30 | `shrinkage/prior=cluster/days=30/strength=3/min_support=5/penalty=0.1` | 7→7/20 (+0) | 2→3/13 (+1) | 0→0/6 (+0) | 3→2/8 (-1) | validation gain reversed later |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_pre | top5 | `local_draws/draws=10/min_support=10/penalty=0.05` | 13→13/23 (+0) | 6→9/15 (+3) | 3→1/7 (-2) | 4→6/10 (+2) | validation gain reversed later |
| close_pre | avoid2 | `local_draws/draws=20/min_support=5/penalty=0.05` | 9→9/23 (+0) | 6→9/15 (+3) | 5→3/7 (-2) | 4→3/10 (-1) | validation gain reversed later |
| close_pre | panel10 | `baseline` | 2→2/23 (+0) | 2→2/15 (+0) | 1→1/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| close_pre | sp30 | `local_calendar/days=14/min_support=10/penalty=0.05` | 3→3/19 (+0) | 3→5/12 (+2) | 2→4/6 (+2) | 2→0/8 (-2) | validation gain reversed later |
| close_pre | dp20 | `shrinkage/prior=pool/days=60/strength=8/min_support=5/penalty=0.25` | 0→0/4 (+0) | 2→2/3 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_known | top5 | `baseline` | 10→10/23 (+0) | 9→9/15 (+0) | 3→3/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| close_known | avoid2 | `counter_regression/days=60/recent=5/tolerance=0.0/prior=pool/strength=8/min_support=8/penalty=0.15` | 11→15/23 (+4) | 8→9/15 (+1) | 4→4/7 (+0) | 5→4/10 (-1) | validation gain reversed later |
| close_known | panel10 | `local_calendar/days=14/min_support=5/penalty=0.05` | 2→2/23 (+0) | 0→1/15 (+1) | 2→0/7 (-2) | 0→1/10 (+1) | validation gain reversed later |
| close_known | sp30 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 10→10/19 (+0) | 4→5/12 (+1) | 1→1/6 (+0) | 1→0/8 (-1) | validation gain reversed later |
| close_known | dp20 | `baseline` | 1→1/4 (+0) | 2→2/3 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| jodi_pre | jodi25 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 8→10/23 (+2) | 2→7/15 (+5) | 2→3/7 (+1) | 2→3/10 (+1) | helped in every block |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 14→9/23 (-5) | 7→6/15 (-1) | 3→6/7 (+3) | 5→6/10 (+1) | validation loss reversed later |
| open | top5 | `static/v7_local_weights` | 14→14/23 (+0) | 7→7/15 (+0) | 3→3/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 13→14/23 (+1) | 6→6/15 (+0) | 3→3/7 (+0) | 7→6/10 (-1) | mixed or tied across blocks |
| open | avoid2 | `static/v7_local_weights` | 13→13/23 (+0) | 6→6/15 (+0) | 3→3/7 (+0) | 7→7/10 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 4→4/23 (+0) | 1→1/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_weights` | 4→4/23 (+0) | 1→1/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 7→6/20 (-1) | 2→2/13 (+0) | 0→0/6 (+0) | 3→2/8 (-1) | mixed or tied across blocks |
| open | sp30 | `static/v7_local_weights` | 7→7/20 (+0) | 2→2/13 (+0) | 0→0/6 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_weights` | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_pre | top5 | `static/v7_local_specialists` | 13→12/23 (-1) | 6→3/15 (-3) | 3→4/7 (+1) | 4→5/10 (+1) | validation loss reversed later |
| close_pre | top5 | `static/v7_local_weights` | 13→13/23 (+0) | 6→6/15 (+0) | 3→3/7 (+0) | 4→4/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 9→8/23 (-1) | 6→9/15 (+3) | 5→2/7 (-3) | 4→5/10 (+1) | validation gain reversed later |
| close_pre | avoid2 | `static/v7_local_weights` | 9→9/23 (+0) | 6→6/15 (+0) | 5→5/7 (+0) | 4→4/10 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 2→1/23 (-1) | 2→0/15 (-2) | 1→0/7 (-1) | 0→1/10 (+1) | validation loss reversed later |
| close_pre | panel10 | `static/v7_local_weights` | 2→2/23 (+0) | 2→2/15 (+0) | 1→1/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 3→5/19 (+2) | 3→3/12 (+0) | 2→3/6 (+1) | 2→1/8 (-1) | mixed or tied across blocks |
| close_pre | sp30 | `static/v7_local_weights` | 3→3/19 (+0) | 3→3/12 (+0) | 2→2/6 (+0) | 2→2/8 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 0→0/4 (+0) | 2→2/3 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_weights` | 0→0/4 (+0) | 2→2/3 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_known | top5 | `static/v7_local_specialists` | 10→9/23 (-1) | 9→8/15 (-1) | 3→2/7 (-1) | 5→4/10 (-1) | hurt in every block |
| close_known | top5 | `static/v7_local_weights` | 10→10/23 (+0) | 9→9/15 (+0) | 3→3/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 11→10/23 (-1) | 8→6/15 (-2) | 4→1/7 (-3) | 5→4/10 (-1) | hurt in every block |
| close_known | avoid2 | `static/v7_local_weights` | 11→11/23 (+0) | 8→8/15 (+0) | 4→4/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 2→2/23 (+0) | 0→0/15 (+0) | 2→2/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_weights` | 2→2/23 (+0) | 0→0/15 (+0) | 2→0/7 (-2) | 0→0/10 (+0) | mixed or tied across blocks |
| close_known | sp30 | `static/v7_local_specialists` | 10→9/19 (-1) | 4→4/12 (+0) | 1→2/6 (+1) | 1→1/8 (+0) | mixed or tied across blocks |
| close_known | sp30 | `static/v7_local_weights` | 10→10/19 (+0) | 4→4/12 (+0) | 1→1/6 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 1→1/4 (+0) | 2→2/3 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| close_known | dp20 | `static/v7_local_weights` | 1→1/4 (+0) | 2→2/3 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |

### Sridevi Night

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_calendar/days=14/min_support=10/penalty=0.05` | 10→10/23 (+0) | 10→11/15 (+1) | 4→3/6 (-1) | 6→6/10 (+0) | validation gain reversed later |
| open | avoid2 | `static/v7_local_specialists` | 16→17/23 (+1) | 9→10/15 (+1) | 4→5/6 (+1) | 7→4/10 (-3) | validation gain reversed later |
| open | panel10 | `baseline` | 0→0/23 (+0) | 4→4/15 (+0) | 0→0/6 (+0) | 1→1/10 (+0) | unchanged throughout |
| open | sp30 | `decay/half_life=14/prior=pool/strength=8/min_support=5/penalty=0.25` | 4→4/14 (+0) | 7→7/12 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | dp20 | `counter_regression/days=30/recent=5/tolerance=0.0/prior=none/strength=8/min_support=8/penalty=0.15` | 0→0/9 (+0) | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/4 (+0) | unchanged throughout |
| close_pre | top5 | `local_draws/draws=10/min_support=5/penalty=0.05` | 10→10/23 (+0) | 7→10/15 (+3) | 3→5/6 (+2) | 3→5/10 (+2) | validation gain persisted or tied later |
| close_pre | avoid2 | `baseline` | 10→10/23 (+0) | 11→11/15 (+0) | 3→3/6 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | panel10 | `local_draws/draws=10/min_support=5/penalty=0.05` | 2→2/23 (+0) | 0→1/15 (+1) | 1→0/6 (-1) | 0→1/10 (+1) | validation gain reversed later |
| close_pre | sp30 | `local_calendar/days=14/min_support=10/penalty=0.05` | 7→8/18 (+1) | 3→4/10 (+1) | 1→1/6 (+0) | 1→3/8 (+2) | validation gain persisted or tied later |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 1→1/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| close_known | top5 | `static/new_local_mixture` | 12→12/23 (+0) | 6→9/15 (+3) | 3→4/6 (+1) | 5→4/10 (-1) | validation gain reversed later |
| close_known | avoid2 | `baseline` | 13→13/23 (+0) | 10→10/15 (+0) | 1→1/6 (+0) | 7→7/10 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 0→2/23 (+2) | 0→3/15 (+3) | 1→2/6 (+1) | 3→2/10 (-1) | validation gain reversed later |
| close_known | sp30 | `local_calendar/days=14/min_support=10/penalty=0.3` | 4→4/18 (+0) | 0→4/10 (+4) | 2→1/6 (-1) | 3→2/8 (-1) | validation gain reversed later |
| close_known | dp20 | `baseline` | 2→2/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| jodi_pre | jodi25 | `baseline` | 4→4/23 (+0) | 6→6/15 (+0) | 1→1/6 (+0) | 1→1/10 (+0) | unchanged throughout |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 10→11/23 (+1) | 10→9/15 (-1) | 4→2/6 (-2) | 6→2/10 (-4) | validation loss persisted or tied later |
| open | top5 | `static/v7_local_weights` | 10→10/23 (+0) | 10→10/15 (+0) | 4→3/6 (-1) | 6→7/10 (+1) | mixed or tied across blocks |
| open | avoid2 | `static/v7_local_specialists` | 16→17/23 (+1) | 9→10/15 (+1) | 4→5/6 (+1) | 7→4/10 (-3) | validation gain reversed later |
| open | avoid2 | `static/v7_local_weights` | 16→16/23 (+0) | 9→9/15 (+0) | 4→4/6 (+0) | 7→7/10 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 0→0/23 (+0) | 4→4/15 (+0) | 0→0/6 (+0) | 1→1/10 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_weights` | 0→0/23 (+0) | 4→4/15 (+0) | 0→1/6 (+1) | 1→0/10 (-1) | mixed or tied across blocks |
| open | sp30 | `static/v7_local_specialists` | 4→6/14 (+2) | 7→6/12 (-1) | 1→1/4 (+0) | 1→1/6 (+0) | validation loss persisted or tied later |
| open | sp30 | `static/v7_local_weights` | 4→4/14 (+0) | 7→7/12 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 0→0/9 (+0) | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/4 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_weights` | 0→0/9 (+0) | 1→1/3 (+0) | 1→1/2 (+0) | 0→2/4 (+2) | mixed or tied across blocks |
| close_pre | top5 | `static/v7_local_specialists` | 10→8/23 (-2) | 7→10/15 (+3) | 3→5/6 (+2) | 3→6/10 (+3) | validation gain persisted or tied later |
| close_pre | top5 | `static/v7_local_weights` | 10→10/23 (+0) | 7→7/15 (+0) | 3→3/6 (+0) | 3→3/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 10→11/23 (+1) | 11→9/15 (-2) | 3→4/6 (+1) | 6→6/10 (+0) | validation loss reversed later |
| close_pre | avoid2 | `static/v7_local_weights` | 10→10/23 (+0) | 11→11/15 (+0) | 3→3/6 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 2→1/23 (-1) | 0→0/15 (+0) | 1→1/6 (+0) | 0→0/10 (+0) | mixed or tied across blocks |
| close_pre | panel10 | `static/v7_local_weights` | 2→2/23 (+0) | 0→0/15 (+0) | 1→1/6 (+0) | 0→0/10 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 7→4/18 (-3) | 3→2/10 (-1) | 1→1/6 (+0) | 1→3/8 (+2) | validation loss reversed later |
| close_pre | sp30 | `static/v7_local_weights` | 7→7/18 (+0) | 3→3/10 (+0) | 1→1/6 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 1→1/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| close_pre | dp20 | `static/v7_local_weights` | 1→1/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| close_known | top5 | `static/v7_local_specialists` | 12→13/23 (+1) | 6→7/15 (+1) | 3→2/6 (-1) | 5→4/10 (-1) | validation gain reversed later |
| close_known | top5 | `static/v7_local_weights` | 12→12/23 (+0) | 6→6/15 (+0) | 3→3/6 (+0) | 5→5/10 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 13→9/23 (-4) | 10→9/15 (-1) | 1→3/6 (+2) | 7→5/10 (-2) | validation loss reversed later |
| close_known | avoid2 | `static/v7_local_weights` | 13→13/23 (+0) | 10→10/15 (+0) | 1→1/6 (+0) | 7→7/10 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 0→2/23 (+2) | 0→3/15 (+3) | 1→2/6 (+1) | 3→2/10 (-1) | validation gain reversed later |
| close_known | panel10 | `static/v7_local_weights` | 0→0/23 (+0) | 0→0/15 (+0) | 1→1/6 (+0) | 3→3/10 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 4→4/18 (+0) | 0→1/10 (+1) | 2→0/6 (-2) | 3→4/8 (+1) | validation gain reversed later |
| close_known | sp30 | `static/v7_local_weights` | 4→4/18 (+0) | 0→0/10 (+0) | 2→2/6 (+0) | 3→3/8 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 2→2/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| close_known | dp20 | `static/v7_local_weights` | 2→2/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |

### Time Bazar

| Channel | Endpoint | Frozen approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_calendar/days=14/min_support=10/penalty=0.3` | 10→10/19 (+0) | 6→9/13 (+3) | 2→2/6 (+0) | 4→2/8 (-2) | validation gain reversed later |
| open | avoid2 | `static/v7_local_specialists` | 6→12/19 (+6) | 7→8/13 (+1) | 1→4/6 (+3) | 5→7/8 (+2) | helped in every block |
| open | panel10 | `baseline` | 3→3/19 (+0) | 1→1/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `decay/half_life=14/prior=pool/strength=8/min_support=5/penalty=0.25` | 3→3/15 (+0) | 2→2/7 (+0) | 1→1/3 (+0) | 0→0/3 (+0) | unchanged throughout |
| open | dp20 | `local_calendar/days=14/min_support=5/penalty=0.05` | 2→2/4 (+0) | 2→2/6 (+0) | 0→2/3 (+2) | 0→1/5 (+1) | mixed or tied across blocks |
| close_pre | top5 | `local_draws/draws=20/min_support=10/penalty=0.05` | 6→9/19 (+3) | 7→10/13 (+3) | 2→1/6 (-1) | 4→4/8 (+0) | validation gain reversed later |
| close_pre | avoid2 | `local_draws/draws=10/min_support=5/penalty=0.05` | 9→9/19 (+0) | 6→7/13 (+1) | 0→2/6 (+2) | 6→3/8 (-3) | validation gain reversed later |
| close_pre | panel10 | `local_draws/draws=10/min_support=5/penalty=0.05` | 1→1/19 (+0) | 2→3/13 (+1) | 0→1/6 (+1) | 0→0/8 (+0) | validation gain persisted or tied later |
| close_pre | sp30 | `baseline` | 5→5/16 (+0) | 5→5/12 (+0) | 2→2/5 (+0) | 0→0/4 (+0) | unchanged throughout |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 1→1/3 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | 1→0/4 (-1) | mixed or tied across blocks |
| close_known | top5 | `local_draws/draws=20/min_support=10/penalty=0.05` | 10→11/19 (+1) | 6→10/13 (+4) | 4→4/6 (+0) | 4→3/8 (-1) | validation gain reversed later |
| close_known | avoid2 | `local_calendar/days=14/min_support=10/penalty=0.05` | 10→12/19 (+2) | 7→9/13 (+2) | 5→2/6 (-3) | 7→5/8 (-2) | validation gain reversed later |
| close_known | panel10 | `static/v7_local_specialists` | 1→1/19 (+0) | 2→3/13 (+1) | 0→0/6 (+0) | 0→0/8 (+0) | validation gain persisted or tied later |
| close_known | sp30 | `empirical_bernstein/days=60/min_support=8/penalty=0.1` | 5→6/16 (+1) | 3→5/12 (+2) | 2→1/5 (-1) | 3→2/4 (-1) | validation gain reversed later |
| close_known | dp20 | `baseline` | 1→1/3 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | unchanged throughout |
| jodi_pre | jodi25 | `local_calendar/days=14/min_support=5/penalty=0.05` | 2→2/19 (+0) | 3→7/13 (+4) | 0→0/6 (+0) | 1→2/8 (+1) | validation gain persisted or tied later |

Fixed reference approaches, evaluated without selecting winners from later outcomes:

| Channel | Endpoint | Approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `static/v7_local_specialists` | 10→9/19 (-1) | 6→6/13 (+0) | 2→1/6 (-1) | 4→2/8 (-2) | mixed or tied across blocks |
| open | top5 | `static/v7_local_weights` | 10→10/19 (+0) | 6→6/13 (+0) | 2→2/6 (+0) | 4→4/8 (+0) | unchanged throughout |
| open | avoid2 | `static/v7_local_specialists` | 6→12/19 (+6) | 7→8/13 (+1) | 1→4/6 (+3) | 5→7/8 (+2) | helped in every block |
| open | avoid2 | `static/v7_local_weights` | 6→6/19 (+0) | 7→7/13 (+0) | 1→1/6 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | panel10 | `static/v7_local_specialists` | 3→0/19 (-3) | 1→1/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | mixed or tied across blocks |
| open | panel10 | `static/v7_local_weights` | 3→3/19 (+0) | 1→1/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_specialists` | 3→3/15 (+0) | 2→2/7 (+0) | 1→1/3 (+0) | 0→0/3 (+0) | unchanged throughout |
| open | sp30 | `static/v7_local_weights` | 3→3/15 (+0) | 2→2/7 (+0) | 1→1/3 (+0) | 0→0/3 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_specialists` | 2→2/4 (+0) | 2→2/6 (+0) | 0→0/3 (+0) | 0→0/5 (+0) | unchanged throughout |
| open | dp20 | `static/v7_local_weights` | 2→2/4 (+0) | 2→2/6 (+0) | 0→0/3 (+0) | 0→0/5 (+0) | unchanged throughout |
| close_pre | top5 | `static/v7_local_specialists` | 6→11/19 (+5) | 7→7/13 (+0) | 2→2/6 (+0) | 4→4/8 (+0) | mixed or tied across blocks |
| close_pre | top5 | `static/v7_local_weights` | 6→6/19 (+0) | 7→7/13 (+0) | 2→2/6 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `static/v7_local_specialists` | 9→7/19 (-2) | 6→7/13 (+1) | 0→2/6 (+2) | 6→5/8 (-1) | validation gain reversed later |
| close_pre | avoid2 | `static/v7_local_weights` | 9→9/19 (+0) | 6→6/13 (+0) | 0→0/6 (+0) | 6→6/8 (+0) | unchanged throughout |
| close_pre | panel10 | `static/v7_local_specialists` | 1→2/19 (+1) | 2→0/13 (-2) | 0→0/6 (+0) | 0→0/8 (+0) | validation loss persisted or tied later |
| close_pre | panel10 | `static/v7_local_weights` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `static/v7_local_specialists` | 5→4/16 (-1) | 5→5/12 (+0) | 2→1/5 (-1) | 0→0/4 (+0) | mixed or tied across blocks |
| close_pre | sp30 | `static/v7_local_weights` | 5→5/16 (+0) | 5→5/12 (+0) | 2→2/5 (+0) | 0→0/4 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_specialists` | 1→1/3 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_pre | dp20 | `static/v7_local_weights` | 1→1/3 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_known | top5 | `static/v7_local_specialists` | 10→11/19 (+1) | 6→7/13 (+1) | 4→5/6 (+1) | 4→2/8 (-2) | validation gain reversed later |
| close_known | top5 | `static/v7_local_weights` | 10→10/19 (+0) | 6→6/13 (+0) | 4→4/6 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | avoid2 | `static/v7_local_specialists` | 10→10/19 (+0) | 7→4/13 (-3) | 5→6/6 (+1) | 7→6/8 (-1) | validation loss reversed later |
| close_known | avoid2 | `static/v7_local_weights` | 10→10/19 (+0) | 7→7/13 (+0) | 5→5/6 (+0) | 7→7/8 (+0) | unchanged throughout |
| close_known | panel10 | `static/v7_local_specialists` | 1→1/19 (+0) | 2→3/13 (+1) | 0→0/6 (+0) | 0→0/8 (+0) | validation gain persisted or tied later |
| close_known | panel10 | `static/v7_local_weights` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_known | sp30 | `static/v7_local_specialists` | 5→5/16 (+0) | 3→4/12 (+1) | 2→0/5 (-2) | 3→2/4 (-1) | validation gain reversed later |
| close_known | sp30 | `static/v7_local_weights` | 5→5/16 (+0) | 3→3/12 (+0) | 2→2/5 (+0) | 3→3/4 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_specialists` | 1→1/3 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_known | dp20 | `static/v7_local_weights` | 1→1/3 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | unchanged throughout |

## Selection counts

Counts refer to market/endpoint choices, not independent discoveries.

| Approach | Choices |
|---|---:|
| `baseline` | 59 |
| `counter_regression/days=30/recent=5/tolerance=0.0/prior=none/strength=8/min_support=8/penalty=0.15` | 1 |
| `counter_regression/days=60/recent=5/tolerance=0.0/prior=pool/strength=8/min_support=8/penalty=0.15` | 1 |
| `decay/half_life=14/prior=none/strength=8/min_support=5/penalty=0.1` | 3 |
| `decay/half_life=14/prior=pool/strength=8/min_support=5/penalty=0.25` | 5 |
| `decay/half_life=30/prior=cluster/strength=8/min_support=5/penalty=0.1` | 1 |
| `decay/half_life=30/prior=pool/strength=8/min_support=5/penalty=0.1` | 1 |
| `decay/half_life=7/prior=cluster/strength=8/min_support=5/penalty=0.1` | 2 |
| `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.1` | 3 |
| `decay/half_life=7/prior=none/strength=8/min_support=5/penalty=0.25` | 2 |
| `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 3 |
| `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.25` | 1 |
| `empirical_bernstein/days=30/min_support=15/penalty=0.1` | 2 |
| `empirical_bernstein/days=60/min_support=8/penalty=0.1` | 2 |
| `local_calendar/days=14/min_support=10/penalty=0.05` | 11 |
| `local_calendar/days=14/min_support=10/penalty=0.3` | 2 |
| `local_calendar/days=14/min_support=5/penalty=0.05` | 15 |
| `local_calendar/days=14/min_support=5/penalty=0.15` | 1 |
| `local_calendar/days=14/min_support=5/penalty=0.3` | 2 |
| `local_calendar/days=30/min_support=10/penalty=0.05` | 1 |
| `local_calendar/days=30/min_support=5/penalty=0.05` | 8 |
| `local_calendar/days=60/min_support=5/penalty=0.05` | 3 |
| `local_draws/draws=10/min_support=10/penalty=0.05` | 2 |
| `local_draws/draws=10/min_support=5/penalty=0.05` | 4 |
| `local_draws/draws=10/min_support=5/penalty=0.3` | 1 |
| `local_draws/draws=20/min_support=10/penalty=0.05` | 4 |
| `local_draws/draws=20/min_support=5/penalty=0.05` | 1 |
| `shrinkage/prior=cluster/days=30/strength=16/min_support=5/penalty=0.25` | 2 |
| `shrinkage/prior=cluster/days=30/strength=3/min_support=5/penalty=0.1` | 1 |
| `shrinkage/prior=cluster/days=60/strength=8/min_support=5/penalty=0.25` | 4 |
| `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 3 |
| `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.1` | 2 |
| `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 8 |
| `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 1 |
| `shrinkage/prior=pool/days=60/strength=3/min_support=5/penalty=0.1` | 1 |
| `shrinkage/prior=pool/days=60/strength=3/min_support=5/penalty=0.25` | 1 |
| `shrinkage/prior=pool/days=60/strength=8/min_support=5/penalty=0.25` | 4 |
| `static/new_local_mixture` | 11 |
| `static/v7_local_specialists` | 13 |

## One coherent source distribution per draw

These separately frozen controllers use the same source distribution for all five outputs. Each selected policy must preserve every endpoint in both selection blocks and strictly improve at least one endpoint in validation. Endpoint-specific choices above can instead route different sources for different outputs. The conditional denominators below remain separate.

### Kalyan

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 10→10/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 7→7/20 (+0) | 4→4/13 (+0) | 2→2/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/20 (+0) | 1→1/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 8→8/15 (+0) | 2→2/12 (+0) | 0→0/3 (+0) | 3→3/7 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 2→2/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_pre | top5 | `local_calendar/days=30/min_support=5/penalty=0.05` | 9→9/20 (+0) | 5→7/13 (+2) | 2→3/5 (+1) | 5→4/8 (-1) | validation gain reversed later |
| close_pre | avoid2 | `local_calendar/days=30/min_support=5/penalty=0.05` | 11→11/20 (+0) | 3→8/13 (+5) | 5→1/5 (-4) | 4→5/8 (+1) | validation gain reversed later |
| close_pre | panel10 | `local_calendar/days=30/min_support=5/penalty=0.05` | 0→0/20 (+0) | 0→1/13 (+1) | 0→0/5 (+0) | 1→0/8 (-1) | validation gain reversed later |
| close_pre | sp30 | `local_calendar/days=30/min_support=5/penalty=0.05` | 2→3/12 (+1) | 1→2/9 (+1) | 1→0/4 (-1) | 2→3/7 (+1) | validation gain reversed later |
| close_pre | dp20 | `local_calendar/days=30/min_support=5/penalty=0.05` | 1→2/8 (+1) | 1→1/4 (+0) | 1→0/1 (-1) | 1→0/1 (-1) | mixed or tied across blocks |
| close_known | top5 | `baseline` | 8→8/20 (+0) | 6→6/13 (+0) | 2→2/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 9→9/20 (+0) | 10→10/13 (+0) | 3→3/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 0→0/20 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 3→3/12 (+0) | 3→3/9 (+0) | 0→0/4 (+0) | 1→1/7 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 2→2/8 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | unchanged throughout |
### Kalyan Night

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 9→9/17 (+0) | 6→6/11 (+0) | 3→3/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 10→10/17 (+0) | 5→5/11 (+0) | 4→4/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 3→3/11 (+0) | 4→4/9 (+0) | 0→0/2 (+0) | 4→4/6 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 3→3/6 (+0) | 1→1/2 (+0) | 1→1/3 (+0) | — / 0 | incomplete eligible history |
| close_pre | top5 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 10→10/17 (+0) | 5→5/11 (+0) | 3→4/5 (+1) | 3→2/6 (-1) | mixed or tied across blocks |
| close_pre | avoid2 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 8→8/17 (+0) | 3→5/11 (+2) | 4→3/5 (-1) | 2→1/6 (-1) | validation gain reversed later |
| close_pre | panel10 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 2→2/17 (+0) | 1→1/11 (+0) | 1→0/5 (-1) | 1→1/6 (+0) | mixed or tied across blocks |
| close_pre | sp30 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 5→5/13 (+0) | 2→2/9 (+0) | 1→2/4 (+1) | 1→1/5 (+0) | mixed or tied across blocks |
| close_pre | dp20 | `shrinkage/prior=pool/days=30/strength=16/min_support=5/penalty=0.1` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | top5 | `baseline` | 6→6/17 (+0) | 7→7/11 (+0) | 3→3/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 10→10/17 (+0) | 4→4/11 (+0) | 3→3/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 0→0/17 (+0) | 0→0/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 4→4/13 (+0) | 5→5/9 (+0) | 2→2/4 (+0) | 3→3/5 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | unchanged throughout |
### Madhur Day

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `local_draws/draws=10/min_support=5/penalty=0.3` | 13→13/23 (+0) | 7→8/15 (+1) | 3→3/7 (+0) | 4→4/10 (+0) | validation gain persisted or tied later |
| open | avoid2 | `local_draws/draws=10/min_support=5/penalty=0.3` | 7→7/23 (+0) | 5→6/15 (+1) | 5→5/7 (+0) | 8→8/10 (+0) | validation gain persisted or tied later |
| open | panel10 | `local_draws/draws=10/min_support=5/penalty=0.3` | 1→1/23 (+0) | 0→0/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| open | sp30 | `local_draws/draws=10/min_support=5/penalty=0.3` | 2→2/15 (+0) | 2→4/11 (+2) | 0→0/6 (+0) | 3→3/6 (+0) | validation gain persisted or tied later |
| open | dp20 | `local_draws/draws=10/min_support=5/penalty=0.3` | 3→3/7 (+0) | 1→2/4 (+1) | 0→0/1 (+0) | 2→2/4 (+0) | validation gain persisted or tied later |
| close_pre | top5 | `baseline` | 14→14/23 (+0) | 8→8/15 (+0) | 2→2/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 14→14/23 (+0) | 6→6/15 (+0) | 4→4/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 1→1/23 (+0) | 0→0/15 (+0) | 1→1/7 (+0) | 2→2/10 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 4→4/19 (+0) | 0→0/11 (+0) | 2→2/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_known | top5 | `baseline` | 9→9/23 (+0) | 9→9/15 (+0) | 3→3/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 16→16/23 (+0) | 8→8/15 (+0) | 4→4/7 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 1→1/23 (+0) | 1→1/15 (+0) | 0→0/7 (+0) | 1→1/10 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 9→9/19 (+0) | 3→3/11 (+0) | 2→2/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | unchanged throughout |
### Madhur Night

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 9→9/20 (+0) | 5→5/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | avoid2 | `baseline` | 11→11/20 (+0) | 7→7/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | panel10 | `baseline` | 0→0/20 (+0) | 2→2/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | sp30 | `baseline` | 2→2/12 (+0) | 3→3/5 (+0) | — / 0 | — / 0 | incomplete eligible history |
| open | dp20 | `baseline` | 3→3/8 (+0) | 0→0/4 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | top5 | `local_draws/draws=10/min_support=5/penalty=0.3` | 8→8/20 (+0) | 3→4/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | avoid2 | `local_draws/draws=10/min_support=5/penalty=0.3` | 15→15/20 (+0) | 4→4/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | panel10 | `local_draws/draws=10/min_support=5/penalty=0.3` | 1→1/20 (+0) | 0→1/9 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | sp30 | `local_draws/draws=10/min_support=5/penalty=0.3` | 4→4/11 (+0) | 1→2/8 (+1) | — / 0 | — / 0 | incomplete eligible history |
| close_pre | dp20 | `local_draws/draws=10/min_support=5/penalty=0.3` | 4→4/9 (+0) | 0→0/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | top5 | `baseline` | 13→13/20 (+0) | 4→4/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | avoid2 | `baseline` | 12→12/20 (+0) | 5→5/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | panel10 | `baseline` | 2→2/20 (+0) | 0→0/9 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | sp30 | `baseline` | 2→2/11 (+0) | 1→1/8 (+0) | — / 0 | — / 0 | incomplete eligible history |
| close_known | dp20 | `baseline` | 3→3/9 (+0) | 1→1/1 (+0) | — / 0 | — / 0 | incomplete eligible history |
### Main Bazar

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 10→10/17 (+0) | 7→7/11 (+0) | 4→4/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 3→3/17 (+0) | 2→2/11 (+0) | 2→2/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 0→0/17 (+0) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 1→1/13 (+0) | 0→0/9 (+0) | 1→1/5 (+0) | 0→0/4 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 0→0/4 (+0) | 1→1/2 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `baseline` | 7→7/17 (+0) | 5→5/11 (+0) | 4→4/5 (+0) | 4→4/6 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 9→9/17 (+0) | 7→7/11 (+0) | 4→4/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 0→0/17 (+0) | 2→2/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 1→1/14 (+0) | 4→4/7 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
| close_known | top5 | `baseline` | 10→10/17 (+0) | 6→6/11 (+0) | 1→1/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 9→9/17 (+0) | 5→5/11 (+0) | 3→3/5 (+0) | 3→3/6 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 0→0/17 (+0) | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 5→5/14 (+0) | 1→1/7 (+0) | 1→1/4 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 0→0/3 (+0) | 0→0/4 (+0) | 0→0/1 (+0) | — / 0 | incomplete eligible history |
### Milan Day

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 11→11/19 (+0) | 8→8/13 (+0) | 2→2/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 9→9/19 (+0) | 9→9/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 0→0/19 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 2→2/14 (+0) | 3→3/9 (+0) | 0→0/2 (+0) | 1→1/7 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 1→1/4 (+0) | 0→0/4 (+0) | 2→2/3 (+0) | 0→0/1 (+0) | unchanged throughout |
| close_pre | top5 | `baseline` | 6→6/19 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 6→6/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 6→6/19 (+0) | 9→9/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 2→2/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 2→2/17 (+0) | 1→1/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_pre | dp20 | `baseline` | 0→0/2 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_known | top5 | `baseline` | 10→10/19 (+0) | 4→4/13 (+0) | 4→4/5 (+0) | 6→6/8 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 9→9/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 3→3/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 7→7/17 (+0) | 0→0/5 (+0) | — / 0 | 1→1/4 (+0) | incomplete eligible history |
| close_known | dp20 | `baseline` | 0→0/2 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) | unchanged throughout |
### Milan Night

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 6→6/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 6→6/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/19 (+0) | 3→3/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 2→2/16 (+0) | 6→6/12 (+0) | 0→0/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 1→1/3 (+0) | 0→0/1 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `baseline` | 13→13/19 (+0) | 7→7/13 (+0) | 2→2/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 9→9/19 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 0→0/19 (+0) | 0→0/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 3→3/19 (+0) | 1→1/8 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | — / 0 | 1→1/5 (+0) | 0→0/1 (+0) | 1→1/2 (+0) | incomplete eligible history |
| close_known | top5 | `baseline` | 13→13/19 (+0) | 8→8/13 (+0) | 3→3/5 (+0) | 7→7/8 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 10→10/19 (+0) | 6→6/13 (+0) | 4→4/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 7→7/19 (+0) | 3→3/8 (+0) | 1→1/4 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | — / 0 | 0→0/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | incomplete eligible history |
### Rajdhani Day

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 12→12/20 (+0) | 7→7/13 (+0) | 2→2/5 (+0) | 3→3/8 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 5→5/20 (+0) | 5→5/13 (+0) | 2→2/5 (+0) | 6→6/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/20 (+0) | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 5→5/16 (+0) | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 1→1/4 (+0) | 0→0/5 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_pre | top5 | `baseline` | 7→7/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 10→10/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 5→5/8 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 2→2/20 (+0) | 3→3/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 6→6/13 (+0) | 5→5/11 (+0) | 2→2/4 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | 3→3/7 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
| close_known | top5 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 11→11/20 (+0) | 8→9/13 (+1) | 5→5/5 (+0) | 1→1/8 (+0) | validation gain persisted or tied later |
| close_known | avoid2 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 8→8/20 (+0) | 7→7/13 (+0) | 3→3/5 (+0) | 2→2/8 (+0) | unchanged throughout |
| close_known | panel10 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 5→5/20 (+0) | 0→0/13 (+0) | 2→2/5 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_known | sp30 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 1→1/13 (+0) | 4→5/11 (+1) | 2→2/4 (+0) | 1→1/6 (+0) | validation gain persisted or tied later |
| close_known | dp20 | `shrinkage/prior=pool/days=30/strength=3/min_support=5/penalty=0.25` | 4→4/7 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
### Rajdhani Night

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 12→12/17 (+0) | 3→3/11 (+0) | 3→3/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 7→7/17 (+0) | 7→7/11 (+0) | 3→3/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 1→1/17 (+0) | 1→1/11 (+0) | 2→2/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 4→4/9 (+0) | 4→4/8 (+0) | 2→2/5 (+0) | 0→0/5 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 3→3/8 (+0) | 1→1/3 (+0) | — / 0 | 0→0/1 (+0) | incomplete eligible history |
| close_pre | top5 | `shrinkage/prior=cluster/days=30/strength=8/min_support=5/penalty=0.1` | 12→12/17 (+0) | 2→4/11 (+2) | 2→4/5 (+2) | 2→5/6 (+3) | validation gain persisted or tied later |
| close_pre | avoid2 | `shrinkage/prior=cluster/days=30/strength=8/min_support=5/penalty=0.1` | 8→8/17 (+0) | 8→9/11 (+1) | 3→5/5 (+2) | 0→0/6 (+0) | validation gain persisted or tied later |
| close_pre | panel10 | `shrinkage/prior=cluster/days=30/strength=8/min_support=5/penalty=0.1` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_pre | sp30 | `shrinkage/prior=cluster/days=30/strength=8/min_support=5/penalty=0.1` | 5→5/15 (+0) | 2→2/9 (+0) | 0→1/4 (+1) | 1→2/4 (+1) | mixed or tied across blocks |
| close_pre | dp20 | `shrinkage/prior=cluster/days=30/strength=8/min_support=5/penalty=0.1` | 0→0/2 (+0) | 0→1/2 (+1) | 0→0/1 (+0) | 0→0/2 (+0) | validation gain persisted or tied later |
| close_known | top5 | `baseline` | 7→7/17 (+0) | 7→7/11 (+0) | 5→5/5 (+0) | 2→2/6 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 10→10/17 (+0) | 5→5/11 (+0) | 2→2/5 (+0) | 5→5/6 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 3→3/17 (+0) | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 2→2/15 (+0) | 3→3/9 (+0) | 2→2/4 (+0) | 2→2/4 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 0→0/2 (+0) | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | unchanged throughout |
### Sridevi

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 14→14/23 (+0) | 7→7/15 (+0) | 3→3/7 (+0) | 5→5/10 (+0) | unchanged throughout |
| open | avoid2 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 13→13/23 (+0) | 6→7/15 (+1) | 3→3/7 (+0) | 7→9/10 (+2) | validation gain persisted or tied later |
| open | panel10 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 4→4/23 (+0) | 1→1/15 (+0) | 0→0/7 (+0) | 0→2/10 (+2) | mixed or tied across blocks |
| open | sp30 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 7→7/20 (+0) | 2→2/13 (+0) | 0→1/6 (+1) | 3→4/8 (+1) | mixed or tied across blocks |
| open | dp20 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 1→1/3 (+0) | 1→1/2 (+0) | 0→1/1 (+1) | 0→1/2 (+1) | mixed or tied across blocks |
| close_pre | top5 | `baseline` | 13→13/23 (+0) | 6→6/15 (+0) | 3→3/7 (+0) | 4→4/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 9→9/23 (+0) | 6→6/15 (+0) | 5→5/7 (+0) | 4→4/10 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 2→2/23 (+0) | 2→2/15 (+0) | 1→1/7 (+0) | 0→0/10 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 3→3/19 (+0) | 3→3/12 (+0) | 2→2/6 (+0) | 2→2/8 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | 0→0/4 (+0) | 2→2/3 (+0) | — / 0 | 1→1/2 (+0) | incomplete eligible history |
| close_known | top5 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 10→11/23 (+1) | 9→9/15 (+0) | 3→3/7 (+0) | 5→4/10 (-1) | mixed or tied across blocks |
| close_known | avoid2 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 11→12/23 (+1) | 8→9/15 (+1) | 4→4/7 (+0) | 5→3/10 (-2) | validation gain reversed later |
| close_known | panel10 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 2→3/23 (+1) | 0→0/15 (+0) | 2→0/7 (-2) | 0→0/10 (+0) | mixed or tied across blocks |
| close_known | sp30 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 10→10/19 (+0) | 4→4/12 (+0) | 1→1/6 (+0) | 1→0/8 (-1) | mixed or tied across blocks |
| close_known | dp20 | `decay/half_life=7/prior=pool/strength=8/min_support=5/penalty=0.1` | 1→2/4 (+1) | 2→2/3 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
### Sridevi Night

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 10→10/23 (+0) | 10→10/15 (+0) | 4→4/6 (+0) | 6→6/10 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 16→16/23 (+0) | 9→9/15 (+0) | 4→4/6 (+0) | 7→7/10 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 0→0/23 (+0) | 4→4/15 (+0) | 0→0/6 (+0) | 1→1/10 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 4→4/14 (+0) | 7→7/12 (+0) | 1→1/4 (+0) | 1→1/6 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 0→0/9 (+0) | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/4 (+0) | unchanged throughout |
| close_pre | top5 | `baseline` | 10→10/23 (+0) | 7→7/15 (+0) | 3→3/6 (+0) | 3→3/10 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 10→10/23 (+0) | 11→11/15 (+0) | 3→3/6 (+0) | 6→6/10 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 2→2/23 (+0) | 0→0/15 (+0) | 1→1/6 (+0) | 0→0/10 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 7→7/18 (+0) | 3→3/10 (+0) | 1→1/6 (+0) | 1→1/8 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | 1→1/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
| close_known | top5 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 12→12/23 (+0) | 6→6/15 (+0) | 3→2/6 (-1) | 5→5/10 (+0) | mixed or tied across blocks |
| close_known | avoid2 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 13→13/23 (+0) | 10→10/15 (+0) | 1→4/6 (+3) | 7→5/10 (-2) | mixed or tied across blocks |
| close_known | panel10 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 0→0/23 (+0) | 0→1/15 (+1) | 1→2/6 (+1) | 3→2/10 (-1) | validation gain reversed later |
| close_known | sp30 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 4→4/18 (+0) | 0→2/10 (+2) | 2→2/6 (+0) | 3→3/8 (+0) | validation gain persisted or tied later |
| close_known | dp20 | `shrinkage/prior=pool/days=30/strength=8/min_support=5/penalty=0.1` | 2→2/5 (+0) | 3→3/5 (+0) | — / 0 | 0→0/2 (+0) | incomplete eligible history |
### Time Bazar

| Channel | Endpoint | Coherent approach | Sep 8–30 | Oct 1–15 | Oct 16–22 reused | Oct 23–Nov 1 reused | Observed direction |
|---|---|---|---|---|---|---|---|
| open | top5 | `baseline` | 10→10/19 (+0) | 6→6/13 (+0) | 2→2/6 (+0) | 4→4/8 (+0) | unchanged throughout |
| open | avoid2 | `baseline` | 6→6/19 (+0) | 7→7/13 (+0) | 1→1/6 (+0) | 5→5/8 (+0) | unchanged throughout |
| open | panel10 | `baseline` | 3→3/19 (+0) | 1→1/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| open | sp30 | `baseline` | 3→3/15 (+0) | 2→2/7 (+0) | 1→1/3 (+0) | 0→0/3 (+0) | unchanged throughout |
| open | dp20 | `baseline` | 2→2/4 (+0) | 2→2/6 (+0) | 0→0/3 (+0) | 0→0/5 (+0) | unchanged throughout |
| close_pre | top5 | `baseline` | 6→6/19 (+0) | 7→7/13 (+0) | 2→2/6 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_pre | avoid2 | `baseline` | 9→9/19 (+0) | 6→6/13 (+0) | 0→0/6 (+0) | 6→6/8 (+0) | unchanged throughout |
| close_pre | panel10 | `baseline` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_pre | sp30 | `baseline` | 5→5/16 (+0) | 5→5/12 (+0) | 2→2/5 (+0) | 0→0/4 (+0) | unchanged throughout |
| close_pre | dp20 | `baseline` | 1→1/3 (+0) | 1→1/1 (+0) | 1→1/1 (+0) | 1→1/4 (+0) | unchanged throughout |
| close_known | top5 | `baseline` | 10→10/19 (+0) | 6→6/13 (+0) | 4→4/6 (+0) | 4→4/8 (+0) | unchanged throughout |
| close_known | avoid2 | `baseline` | 10→10/19 (+0) | 7→7/13 (+0) | 5→5/6 (+0) | 7→7/8 (+0) | unchanged throughout |
| close_known | panel10 | `baseline` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) | unchanged throughout |
| close_known | sp30 | `baseline` | 5→5/16 (+0) | 3→3/12 (+0) | 2→2/5 (+0) | 3→3/4 (+0) | unchanged throughout |
| close_known | dp20 | `baseline` | 1→1/3 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | unchanged throughout |

Each endpoint selects from many related variants on small reused blocks. Validation gains can reverse. Later blocks are diagnostics and must remain visible even when they contradict the chosen approach.
