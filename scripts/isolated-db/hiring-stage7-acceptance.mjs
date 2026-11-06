// Complete the real authenticated API + browser layer; SQL model matrix runs in verify.
import { writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
process.env.STAGE7_CHAIN = "1";
await import("./hiring-stage7-chain.mjs");
await import("./hiring-stage7-client.mjs");
const { out, runId, W, results } = await import("./hiring-stage7.mjs");
const ui = spawnSync(process.execPath, ["scripts/isolated-db/hiring-stage7-ui.mjs"], {
  env: process.env,
  stdio: "inherit",
});
if (ui.status !== 0) throw Error("Browser acceptance was not completed");
const browser = JSON.parse(readFileSync(out + "/ui-results.json", "utf8"));
if (!browser.complete) throw Error("Browser acceptance incomplete");
writeFileSync(
  out + "/results.json",
  JSON.stringify(
    {
      runId,
      workspaceId: W,
      results,
      browser: browser.results,
      complete: true,
      scope:
        "real-GoTrue API and browser; model/security SQL matrix is separately required by verify",
    },
    null,
    2,
  ),
);
process.exitCode = 0;
console.log("Authenticated API and browser acceptance completed.");
