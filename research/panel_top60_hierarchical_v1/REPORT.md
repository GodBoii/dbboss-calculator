# Hierarchical sutta-to-panel Top-60 audit

Generated: 2026-07-24T01:25:29.962520+05:30

Every candidate emits exactly 60 unique legal panels. The allocation strategy is selected only on the historical model-selection block.

| Task | Selected strategy | Selection baseline | Selection selected | Terminal baseline | Terminal selected | Forward baseline | Forward selected | Forward p |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| open | `fixed:learned:learned_mass:8x7+4` | 40.0% | 40.9% | 34.7% | 34.5% | 39.3% | 42.7% | 0.3018 |
| close_preopen | `flat:learned` | 41.7% | 41.7% | 39.9% | 39.9% | 36.7% | 36.7% | 1.0000 |

## open selection leaders

| Strategy | Hits | Rate |
|---|---:|---:|
| `fixed:learned:learned_mass:8x7+4` | 368 | 40.9% |
| `flat:learned` | 360 | 40.0% |
| `proportional:learned:mass_blend:t1.0` | 359 | 39.9% |
| `fixed:learned:mass_blend:8x7+4` | 356 | 39.6% |
| `fixed:learned:learned_mass:10x6` | 354 | 39.4% |
| `proportional:learned:learned_mass:t0.5` | 354 | 39.4% |
| `proportional:learned:learned_mass:t1.0` | 354 | 39.4% |
| `fixed:learned:learned_mass:6x10` | 353 | 39.3% |
| `fixed:learned:profile_mass:6x10` | 353 | 39.3% |
| `fixed:learned:mass_blend:6x10` | 353 | 39.3% |
| `proportional:learned:learned_mass:t2.0` | 351 | 39.0% |
| `proportional:learned:mass_blend:t0.5` | 350 | 38.9% |
| `proportional:learned:mass_blend:t2.0` | 350 | 38.9% |
| `fixed:panel_blend:learned_mass:8x7+4` | 345 | 38.4% |
| `fixed:learned:learned_mass:12x5` | 344 | 38.3% |
| `fixed:panel_blend:learned_mass:10x6` | 343 | 38.2% |
| `fixed:learned:mass_blend:10x6` | 342 | 38.0% |
| `fixed:panel_blend:learned_mass:12x5` | 341 | 37.9% |
| `fixed:panel_blend:mass_blend:10x6` | 341 | 37.9% |
| `proportional:learned:profile_mass:t2.0` | 339 | 37.7% |

## close_preopen selection leaders

| Strategy | Hits | Rate |
|---|---:|---:|
| `flat:learned` | 375 | 41.7% |
| `fixed:learned:learned_mass:8x7+4` | 373 | 41.5% |
| `fixed:learned:mass_blend:8x7+4` | 370 | 41.2% |
| `proportional:learned:mass_blend:t2.0` | 370 | 41.2% |
| `proportional:learned:learned_mass:t0.5` | 369 | 41.0% |
| `proportional:learned:profile_mass:t1.0` | 367 | 40.8% |
| `fixed:learned:learned_mass:6x10` | 365 | 40.6% |
| `fixed:learned:profile_mass:6x10` | 365 | 40.6% |
| `fixed:learned:mass_blend:6x10` | 365 | 40.6% |
| `proportional:learned:learned_mass:t1.0` | 364 | 40.5% |
| `proportional:learned:learned_mass:t2.0` | 364 | 40.5% |
| `proportional:learned:mass_blend:t1.0` | 364 | 40.5% |
| `proportional:learned:profile_mass:t2.0` | 361 | 40.2% |
| `proportional:learned:profile_mass:t0.5` | 360 | 40.0% |
| `flat:panel_blend` | 359 | 39.9% |
| `fixed:learned:profile_mass:8x7+4` | 359 | 39.9% |
| `fixed:panel_blend:learned_mass:6x10` | 358 | 39.8% |
| `fixed:panel_blend:profile_mass:6x10` | 358 | 39.8% |
| `fixed:panel_blend:mass_blend:6x10` | 358 | 39.8% |
| `fixed:panel_blend:learned_mass:8x7+4` | 357 | 39.7% |

## Promotion gate

A strategy is eligible only if the selection improvement repeats on both the terminal and post-cache blocks and the paired comparison is credible. A later gain that was not selected in advance is not promoted.
