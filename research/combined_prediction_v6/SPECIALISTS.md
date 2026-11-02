# Independent output specialist routing

This independent-output-routing design was conceived AFTER reading the main study extension scores. Source specialist choices were frozen before fetching extension outcomes; router combinations were not preregistered before that fetch.

This is a posthoc diagnostic. The extension is displayed after historical selection and cannot validate a newly preregistered claim. No production changes were made.

Each bit in `TAP` chooses production (0) or the previously frozen specialist (1), independently for Top5Sutta, avoid-two, and panels. Components retain their original output budgets. This routing can be inconsistent with a single panel distribution. All 936 configurations, including guard failures and equivalent routes, appear in `specialist_combinations.csv` over all six blocks (5,616 rows).

Selection requires a nonnegative joint training delta, strictly positive joint validation delta, and no component regression in either historical refinement block; each component uses its own eligibility. Historical minimum sizes are 15 training and 8 validation eligible rows. The extension never breaks ties or changes the winner.

## Pooled scope: historically selected routes

|Channel|Panel budget|TAP|Train joint Δ|Validation joint Δ|Extension n|Extension baseline → route joint|Extension joint Δ|Extension component Δ (T/A/P)|
|---|---|---|---:|---:|---:|---|---:|---|
|open|panel10|000|+0|+0|88|2 → 2|+0|+0/+0/+0|
|open|sp30|000|+0|+0|64|7 → 7|+0|+0/+0/+0|
|open|dp20|101|+8|+4|24|1 → 8|+7|-2/+0/+6|
|close_pre|panel10|011|+0|+2|88|3 → 1|-2|+0/+2/+2|
|close_pre|sp30|000|+0|+0|66|5 → 5|+0|+0/+0/+0|
|close_pre|dp20|101|+4|+9|21|2 → 2|+0|+8/+0/+0|
|close_known|panel10|011|+2|+2|88|2 → 2|+0|+0/-1/-1|
|close_known|sp30|000|+0|+0|66|8 → 8|+0|+0/+0/+0|
|close_known|dp20|001|+0|+5|21|0 → 3|+3|+0/+0/+4|

Across all 117 channel/scope/budget selectors, 41 historically select a nonproduction route. Their extension joint deltas are positive in 5, zero in 30, and negative in 6. These counts overlap because pooled and market scopes and panel budgets share observations; they are not independent experiments.

## Every market selector

|Channel|Market|Budget|TAP|Validation joint Δ|Extension joint Δ|Extension component Δ (T/A/P)|
|---|---|---|---|---:|---:|---|
|open|Kalyan|panel10|011|+2|+0|+0/+1/+0|
|open|Kalyan|sp30|111|+2|+1|+0/+1/+0|
|open|Kalyan|dp20|000|+0|+0|+0/+0/+0|
|open|Kalyan Night|panel10|101|+2|-1|-4/+0/-1|
|open|Kalyan Night|sp30|000|+0|+0|+0/+0/+0|
|open|Kalyan Night|dp20|000|+0|+0|+0/+0/+0|
|open|Madhur Day|panel10|101|+1|+0|+3/+0/+1|
|open|Madhur Day|sp30|000|+0|+0|+0/+0/+0|
|open|Madhur Day|dp20|000|+0|+0|+0/+0/+0|
|open|Madhur Night|panel10|000|+0|+0|+0/+0/+0|
|open|Madhur Night|sp30|000|+0|+0|+0/+0/+0|
|open|Madhur Night|dp20|000|+0|+0|+0/+0/+0|
|open|Main Bazar|panel10|011|+2|+0|+0/+1/+0|
|open|Main Bazar|sp30|000|+0|+0|+0/+0/+0|
|open|Main Bazar|dp20|000|+0|+0|+0/+0/+0|
|open|Milan Day|panel10|001|+1|+0|+0/+0/+0|
|open|Milan Day|sp30|000|+0|+0|+0/+0/+0|
|open|Milan Day|dp20|000|+0|+0|+0/+0/+0|
|open|Milan Night|panel10|001|+2|+0|+0/+0/-1|
|open|Milan Night|sp30|000|+0|+0|+0/+0/+0|
|open|Milan Night|dp20|000|+0|+0|+0/+0/+0|
|open|Rajdhani Day|panel10|111|+2|+1|+2/-2/+1|
|open|Rajdhani Day|sp30|111|+3|+0|+2/-2/+1|
|open|Rajdhani Day|dp20|000|+0|+0|+0/+0/+0|
|open|Rajdhani Night|panel10|101|+1|+0|+0/+0/+0|
|open|Rajdhani Night|sp30|000|+0|+0|+0/+0/+0|
|open|Rajdhani Night|dp20|000|+0|+0|+0/+0/+0|
|open|Sridevi|panel10|000|+0|+0|+0/+0/+0|
|open|Sridevi|sp30|000|+0|+0|+0/+0/+0|
|open|Sridevi|dp20|000|+0|+0|+0/+0/+0|
|open|Sridevi Night|panel10|101|+1|+0|+0/+0/+0|
|open|Sridevi Night|sp30|000|+0|+0|+0/+0/+0|
|open|Sridevi Night|dp20|000|+0|+0|+0/+0/+0|
|open|Time Bazar|panel10|111|+2|+0|-3/-2/+0|
|open|Time Bazar|sp30|000|+0|+0|+0/+0/+0|
|open|Time Bazar|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Kalyan|panel10|111|+2|+0|+0/-2/+1|
|close_pre|Kalyan|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Kalyan|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Kalyan Night|panel10|000|+0|+0|+0/+0/+0|
|close_pre|Kalyan Night|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Kalyan Night|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Madhur Day|panel10|000|+0|+0|+0/+0/+0|
|close_pre|Madhur Day|sp30|011|+2|-1|+0/-1/-1|
|close_pre|Madhur Day|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Madhur Night|panel10|101|+1|+0|+0/+0/+0|
|close_pre|Madhur Night|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Madhur Night|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Main Bazar|panel10|100|+1|+0|+2/+0/+0|
|close_pre|Main Bazar|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Main Bazar|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Milan Day|panel10|101|+2|-1|+0/+0/-1|
|close_pre|Milan Day|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Milan Day|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Milan Night|panel10|001|+1|+0|+0/+0/+0|
|close_pre|Milan Night|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Milan Night|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Rajdhani Day|panel10|000|+0|+0|+0/+0/+0|
|close_pre|Rajdhani Day|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Rajdhani Day|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Rajdhani Night|panel10|000|+0|+0|+0/+0/+0|
|close_pre|Rajdhani Night|sp30|111|+1|+0|-1/+1/-1|
|close_pre|Rajdhani Night|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Sridevi|panel10|000|+0|+0|+0/+0/+0|
|close_pre|Sridevi|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Sridevi|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Sridevi Night|panel10|001|+2|+0|+0/+0/+0|
|close_pre|Sridevi Night|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Sridevi Night|dp20|000|+0|+0|+0/+0/+0|
|close_pre|Time Bazar|panel10|001|+2|+0|+0/+0/+0|
|close_pre|Time Bazar|sp30|000|+0|+0|+0/+0/+0|
|close_pre|Time Bazar|dp20|000|+0|+0|+0/+0/+0|
|close_known|Kalyan|panel10|101|+1|-1|+0/+0/-1|
|close_known|Kalyan|sp30|000|+0|+0|+0/+0/+0|
|close_known|Kalyan|dp20|000|+0|+0|+0/+0/+0|
|close_known|Kalyan Night|panel10|101|+2|+0|+2/+0/+0|
|close_known|Kalyan Night|sp30|000|+0|+0|+0/+0/+0|
|close_known|Kalyan Night|dp20|000|+0|+0|+0/+0/+0|
|close_known|Madhur Day|panel10|111|+2|+0|+1/-1/-1|
|close_known|Madhur Day|sp30|101|+3|+1|+1/+0/+1|
|close_known|Madhur Day|dp20|000|+0|+0|+0/+0/+0|
|close_known|Madhur Night|panel10|101|+1|+0|+0/+0/+0|
|close_known|Madhur Night|sp30|000|+0|+0|+0/+0/+0|
|close_known|Madhur Night|dp20|000|+0|+0|+0/+0/+0|
|close_known|Main Bazar|panel10|011|+3|+0|+0/+0/-1|
|close_known|Main Bazar|sp30|000|+0|+0|+0/+0/+0|
|close_known|Main Bazar|dp20|000|+0|+0|+0/+0/+0|
|close_known|Milan Day|panel10|011|+1|+0|+0/-2/+0|
|close_known|Milan Day|sp30|000|+0|+0|+0/+0/+0|
|close_known|Milan Day|dp20|000|+0|+0|+0/+0/+0|
|close_known|Milan Night|panel10|101|+3|+0|+0/+0/-1|
|close_known|Milan Night|sp30|101|+1|+0|+0/+0/+0|
|close_known|Milan Night|dp20|000|+0|+0|+0/+0/+0|
|close_known|Rajdhani Day|panel10|000|+0|+0|+0/+0/+0|
|close_known|Rajdhani Day|sp30|000|+0|+0|+0/+0/+0|
|close_known|Rajdhani Day|dp20|000|+0|+0|+0/+0/+0|
|close_known|Rajdhani Night|panel10|000|+0|+0|+0/+0/+0|
|close_known|Rajdhani Night|sp30|111|+2|+0|+0/+0/-1|
|close_known|Rajdhani Night|dp20|000|+0|+0|+0/+0/+0|
|close_known|Sridevi|panel10|011|+4|+0|+0/+0/+0|
|close_known|Sridevi|sp30|011|+1|+0|+0/+0/-1|
|close_known|Sridevi|dp20|000|+0|+0|+0/+0/+0|
|close_known|Sridevi Night|panel10|101|+1|+0|+0/+0/-2|
|close_known|Sridevi Night|sp30|000|+0|+0|+0/+0/+0|
|close_known|Sridevi Night|dp20|000|+0|+0|+0/+0/+0|
|close_known|Time Bazar|panel10|111|+3|+0|-2/-2/+0|
|close_known|Time Bazar|sp30|111|+5|-1|-2/-2/-3|
|close_known|Time Bazar|dp20|000|+0|+0|+0/+0/+0|

Verification passed: manual logical fixtures, all frozen manifest hashes, catalogue ID/index mapping, production joint identity, and historical date/market/eligibility/production prefix equality. Every frozen selected-specialist historical hit prefix also matches exactly. Input and script hashes are recorded in `specialist_protocol.json`.

Historical rescore audit found 1 differing nonproduction hit cells across 1 refined metric matrices. These do not affect any selected specialist. Historical routing and selection use the original `hits.npz` values; only new extension dates use `extension_hits.npz`. Exact discrepant indices are recorded in the protocol. This avoids silently revising frozen historical scores.
