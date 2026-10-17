/* Dump the frozen production combination policy for the Python study.
 * Production sources are read, never written. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("../dp_panel_v3/ts-loader.cjs");

const ROOT = path.resolve(__dirname, "../..");
const sourcePath = path.join(ROOT, "src/lib/combined-policy.ts");
const { COMBINED_POLICY, COMBINED_MODEL_ID } = require("../../src/lib/combined-policy.ts");
const sourceSHA256 = crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
const payload = { modelId: COMBINED_MODEL_ID, source: "src/lib/combined-policy.ts", sourceSHA256, policy: COMBINED_POLICY };
fs.writeFileSync(path.join(__dirname, "production_policy.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ modelId: payload.modelId, sourceSHA256, channels: Object.keys(COMBINED_POLICY) }));
