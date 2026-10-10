// Camada WAL do tempo real no banco ISOLADO (não é o serviço Realtime).
// Prova o que o Postgres entrega ao Realtime para as tabelas publicadas: escrita feita como
// usuário sintético autenticado (RLS real) → mudança decodificada no slot lógico.
// NÃO prova: autorização do servidor Realtime, filtros, entrega ao SDK/UI. Esses casos são
// registrados como "not_executed" com o bloqueio exato.
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-isolated";
const env: Record<string, string | undefined> = { ...process.env };
for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]) delete env[k];
const CONN = [
  "-h",
  `${root}/sock`,
  "-p",
  process.env.ISO_PORT ?? "54329",
  "-U",
  "postgres",
  "-d",
  "postgres",
];
const sql = (s: string) => {
  const r = spawnSync("psql", ["-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", ...CONN, "-f", "-"], {
    input: s,
    encoding: "utf8",
    env: env as NodeJS.ProcessEnv,
    timeout: 20_000,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const ADMIN_A = "10000000-0000-4000-8000-000000000001";
const OWN_A = "10000000-0000-4000-8000-000000000002";
const asUser = (uid: string, body: string) =>
  `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true) \\g /dev/null\n${body}\nCOMMIT;`;

type R = { id: string; status: "passed" | "failed" | "not_executed"; detail: string };
const results: R[] = [];
const check = (id: string, ok: boolean, detail: string) =>
  results.push({ id, status: ok ? "passed" : "failed", detail });

const slot = "iso_rt_probe";
sql(
  `SELECT pg_drop_replication_slot('${slot}') FROM pg_replication_slots WHERE slot_name = '${slot}';`,
);
sql(`SELECT 1 FROM pg_create_logical_replication_slot('${slot}', 'test_decoding');`);
try {
  sql(
    asUser(
      ADMIN_A,
      `UPDATE public.workspace_branding SET primary_color = '#123456' WHERE workspace_id = '${WA}';`,
    ),
  );
  sql(
    asUser(
      OWN_A,
      `UPDATE public.workspace_branding SET primary_color = '#654321' WHERE workspace_id = '${WA}';`,
    ),
  ); // RLS: 0 linhas
  sql(
    asUser(
      OWN_A,
      `INSERT INTO public.chat_messages (conversation_id, workspace_owner_id, sender_user_id, body)
    VALUES ('59000000-0000-4000-8000-0000000000a1', '${WA}', '${OWN_A}', '[ISO] rt nova');`,
    ),
  );
  // DELETE em tabela com REPLICA IDENTITY DEFAULT: só a PK sai no WAL.
  sql(
    `INSERT INTO public.module_branding (id, workspace_id, module_id) VALUES ('5c000000-0000-4000-8000-0000000000a1', '${WA}', 'ats') ON CONFLICT DO NOTHING;`,
  );
  sql(`DELETE FROM public.module_branding WHERE id = '5c000000-0000-4000-8000-0000000000a1';`);
  const changes = sql(`SELECT data FROM pg_logical_slot_get_changes('${slot}', NULL, NULL);`).split(
    "\n",
  );
  const br = changes.filter((l) => l.startsWith("table public.workspace_branding: UPDATE"));
  check(
    "wal-branding-update-admin",
    br.length === 1 && br[0].includes(`workspace_id[uuid]:'${WA}'`) && br[0].includes("#123456"),
    `UPDATE do admin decodificado com workspace_id (necessário ao filtro workspace_id=eq.): ${br.length} evento(s)`,
  );
  check(
    "wal-branding-update-denied-member",
    !changes.some((l) => l.includes("#654321")),
    "UPDATE negado por RLS não gera evento",
  );
  check(
    "wal-chat-insert",
    changes.some(
      (l) => l.startsWith("table public.chat_messages: INSERT") && l.includes("[ISO] rt nova"),
    ),
    "INSERT de chat sai no WAL",
  );
  const del = changes.find((l) => l.startsWith("table public.module_branding: DELETE")) ?? "";
  check(
    "wal-module-branding-delete-pk-only",
    del !== "" && !del.includes("workspace_id"),
    "DELETE só traz a PK (REPLICA IDENTITY DEFAULT): filtro por workspace não casa — cliente depende de reconciliação",
  );
} finally {
  sql(`SELECT pg_drop_replication_slot('${slot}');`);
  sql(`UPDATE public.workspace_branding SET primary_color = '#111111' WHERE workspace_id = '${WA}';
       DELETE FROM public.chat_messages WHERE body = '[ISO] rt nova';`);
}

const BLOCK =
  "serviço Supabase Realtime indisponível localmente (sem Docker/podman; nixpkgs sem supabase-realtime)";
for (const id of [
  "sdk-subscribe-branding-workspace",
  "sdk-subscribe-branding-module",
  "sdk-email-threads-list-detail",
  "sdk-whatsapp-messages",
  "sdk-chat-messages",
  "sdk-property-history",
  "sdk-cross-tenant-denied",
  "sdk-update-delete",
  "sdk-reconnect",
  "sdk-revoke",
  "sdk-context-switch",
  "sdk-burst-coalesced",
  "ui-new-message-while-reading-older",
  "ui-draft-and-scroll-preserved",
])
  results.push({ id, status: "not_executed", detail: BLOCK });

mkdirSync(`${root}/artifacts`, { recursive: true });
const count = (s: R["status"]) => results.filter((r) => r.status === s).length;
writeFileSync(
  `${root}/artifacts/realtime.json`,
  JSON.stringify(
    {
      passed: count("passed"),
      failed: count("failed"),
      not_executed: count("not_executed"),
      results,
    },
    null,
    2,
  ),
);
writeFileSync(
  `${root}/artifacts/realtime.xml`,
  `<?xml version="1.0"?>\n<testsuite name="isolated-realtime" tests="${results.length}" failures="${count("failed")}" skipped="${count("not_executed")}">\n` +
    results
      .map(
        (r) =>
          `  <testcase name="${r.id}">${r.status === "failed" ? `<failure message="${r.detail.replace(/"/g, "'")}"/>` : r.status === "not_executed" ? `<skipped message="${r.detail}"/>` : ""}</testcase>`,
      )
      .join("\n") +
    "\n</testsuite>\n",
);
for (const r of results) console.log(`${r.status.toUpperCase().padEnd(12)} ${r.id} — ${r.detail}`);
process.exit(count("failed") ? 1 : 0);
