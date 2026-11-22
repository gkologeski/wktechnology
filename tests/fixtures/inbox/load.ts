/** Test-only loader. No automatic seed replay and no remote/implicit PostgreSQL target. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function assertDisposableInboxTarget(
  env: Record<string, string | undefined>,
  args: readonly string[],
) {
  if (
    !args.includes("--disposable-draft") ||
    env["LOVABLE_BROWSER_AUTH_STATUS"] !== "draft_signed_out" ||
    !["127.0.0.1", "localhost"].includes(env["PGHOST"] ?? "") ||
    env["PGPORT"] !== "8004" ||
    env["PGDATABASE"] !== "postgres"
  ) {
    throw new Error("Not executed: explicit disposable local draft required; no writes attempted.");
  }
  const url = new URL(env["SUPABASE_URL"] ?? "http://127.0.0.1:8001");
  if (
    url.origin !== "http://127.0.0.1:8001" ||
    url.username ||
    url.password ||
    url.pathname !== "/"
  ) {
    throw new Error("Not executed: provider target is not the disposable local backend.");
  }
}

export function loadDisposableInboxFixtures(extra?: "unipile") {
  assertDisposableInboxTarget(process.env, process.argv);
  const preflight = spawnSync(
    "psql",
    [
      "-X",
      "-h",
      "127.0.0.1",
      "-p",
      "8004",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      `
    SELECT host(inet_server_addr())='127.0.0.1' AND inet_server_port()=8004
      AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE NOT (
        (id='fa110000-0000-4000-8000-000000000001' AND slug='gmail-queue-isolated-a') OR
        (id='fa110000-0000-4000-8000-000000000002' AND slug='gmail-queue-isolated-b')));
  `,
    ],
    { encoding: "utf8" },
  );
  if (preflight.status !== 0 || preflight.stdout.trim() !== "t") {
    throw new Error("Not executed: target identity unavailable or non-fixture workspace present.");
  }
  const result = spawnSync(
    "psql",
    [
      "-X",
      "-h",
      "127.0.0.1",
      "-p",
      "8004",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
      "-f",
      fileURLToPath(new URL("./data.sql", import.meta.url)),
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error("Disposable fixture setup failed; private SQL output withheld.");
  if (extra === "unipile") {
    const additional = spawnSync(
      "psql",
      [
        "-X",
        "-h",
        "127.0.0.1",
        "-p",
        "8004",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "--single-transaction",
        "-f",
        fileURLToPath(new URL("./unipile.sql", import.meta.url)),
      ],
      { encoding: "utf8" },
    );
    if (additional.status !== 0)
      throw new Error("Disposable Unipile fixture setup failed; private SQL output withheld.");
  }
}
