// Frozen policies from research/combined_prediction_v1/selection.json.
// Experimental presets; no live fitting or accuracy claims.
export type CombinedChannel = "open" | "close_pre" | "close_known"
export type CombinedEndpoint = "all10" | "sp30" | "dp20"
export interface CombinationWeights {
  sutta: number; appearance: number; avoid_multiplier: number; present_multiplier: number; dp_blend: number; conditional_close: number
}
interface EndpointPolicy { weights: CombinationWeights; markets: Readonly<Record<string, CombinationWeights>> }
export const COMBINED_MODEL_ID = "combined-weighted-v1"
export const COMBINED_POLICY: Readonly<Record<CombinedChannel, Record<CombinedEndpoint, EndpointPolicy>>> = {
  "open": {
    "all10": {
      "weights": {
        "sutta": 0,
        "appearance": 0.25,
        "avoid_multiplier": 0.75,
        "present_multiplier": 1,
        "dp_blend": 0,
        "conditional_close": 0
      },
      "markets": {}
    },
    "sp30": {
      "weights": {
        "sutta": 0,
        "appearance": 1,
        "avoid_multiplier": 1,
        "present_multiplier": 1,
        "dp_blend": 0.5,
        "conditional_close": 0
      },
      "markets": {
        "Kalyan Night": {
          "sutta": 0,
          "appearance": 0,
          "avoid_multiplier": 0.86070798,
          "present_multiplier": 0.75,
          "dp_blend": 1,
          "conditional_close": 0
        },
        "Rajdhani Day": {
          "sutta": 0,
          "appearance": 0,
          "avoid_multiplier": 0.86070798,
          "present_multiplier": 0.75,
          "dp_blend": 1,
          "conditional_close": 0
        },
        "Time Bazar": {
          "sutta": -0.5,
          "appearance": 0,
          "avoid_multiplier": 1,
          "present_multiplier": 1.25,
          "dp_blend": 0.125,
          "conditional_close": 0
        }
      }
    },
    "dp20": {
      "weights": {
        "sutta": 0,
        "appearance": 0,
        "avoid_multiplier": 1,
        "present_multiplier": 1,
        "dp_blend": 1,
        "conditional_close": 0
      },
      "markets": {}
    }
  },
  "close_pre": {
    "all10": {
      "weights": {
        "sutta": 0,
        "appearance": -0.5,
        "avoid_multiplier": 1.16183424,
        "present_multiplier": 1.25,
        "dp_blend": 0,
        "conditional_close": 0
      },
      "markets": {
        "Kalyan": {
          "sutta": 2,
          "appearance": -0.125,
          "avoid_multiplier": 1,
          "present_multiplier": 1,
          "dp_blend": 0,
          "conditional_close": 0
        }
      }
    },
    "sp30": {
      "weights": {
        "sutta": 0,
        "appearance": -0.5,
        "avoid_multiplier": 1,
        "present_multiplier": 1,
        "dp_blend": 0,
        "conditional_close": 0.5
      },
      "markets": {}
    },
    "dp20": {
      "weights": {
        "sutta": 0,
        "appearance": 0,
        "avoid_multiplier": 1.25,
        "present_multiplier": 1,
        "dp_blend": 1,
        "conditional_close": 0.125
      },
      "markets": {}
    }
  },
  "close_known": {
    "all10": {
      "weights": {
        "sutta": 0.25,
        "appearance": 0.5,
        "avoid_multiplier": 1,
        "present_multiplier": 1,
        "dp_blend": 1,
        "conditional_close": 0
      },
      "markets": {
        "Main Bazar": {
          "sutta": 0,
          "appearance": -0.5,
          "avoid_multiplier": 1,
          "present_multiplier": 1.07588497,
          "dp_blend": 0,
          "conditional_close": 0
        }
      }
    },
    "sp30": {
      "weights": {
        "sutta": 0.25,
        "appearance": -0.5,
        "avoid_multiplier": 1,
        "present_multiplier": 1,
        "dp_blend": 0,
        "conditional_close": 0
      },
      "markets": {
        "Kalyan Night": {
          "sutta": 0,
          "appearance": 0.25,
          "avoid_multiplier": 1.25,
          "present_multiplier": 1,
          "dp_blend": 0,
          "conditional_close": 0
        },
        "Madhur Day": {
          "sutta": -0.125,
          "appearance": -0.5,
          "avoid_multiplier": 1,
          "present_multiplier": 1.25,
          "dp_blend": 0,
          "conditional_close": 0
        }
      }
    },
    "dp20": {
      "weights": {
        "sutta": 0,
        "appearance": 0,
        "avoid_multiplier": 1.25,
        "present_multiplier": 1,
        "dp_blend": 0,
        "conditional_close": 0
      },
      "markets": {}
    }
  }
}
