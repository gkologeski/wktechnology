/**
 * Auditoria das regras de acesso do TechERP.
 *
 * Classifica cada tabela do schema `public` em 4 visões:
 *   1 - regra de criador/administrador (criador do registro pode editar/excluir)
 *   2 - regra de workspace/permissão (modelo oficial)
 *   3 - sem regra de acesso própria
 *   4 - outra regra (citada no relatório)
 *
 * Também varre `src/` para apontar telas e server functions que filtram por criador
 * e handlers de escrita sem gate de permissão explícito.
 *
 * Uso: bun run audit:access   (regenera docs/qa/access-rule-audit.md)
 *
 * Requer `psql` com as variáveis PG* do banco do projeto e `rg` (ripgrep) no PATH.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "docs/qa/access-rule-audit.md");

type Policy = {
  table: string;
  name: string;
  permissive: "PERMISSIVE" | "RESTRICTIVE";
  cmd: string;
  roles: string;
  qual: string;
  check: string;
};

type View = "1a" | "1b" | "2" | "3" | "4";

const SEP = "\u0001";

function sh(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return "";
  }
}

function psql(sql: string): string[][] {
  const out = sh("psql", ["-At", "-F", SEP, "-c", sql]);
  return out
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split(SEP));
}

function rg(pattern: string, extra: string[] = []): string[] {
  const out = sh("rg", ["-n", "--no-heading", ...extra, pattern, "src"]);
  return out.split("\n").filter((l) => l.trim().length > 0);
}

/* ------------------------------------------------------------------ marcadores */

const OWNER_RE =
  /(owner_id|created_by|user_id|actor_id|sender_user_id|member_user_id)\s*=\s*auth\.uid\(\)|is_workspace_admin_of\s*\(/i;
const WS_RE =
  /is_workspace_member|current_user_workspaces|is_workspace_admin_v2|is_workspace_admin\s*\(|user_has_permission|user_can_act|techhire_rbac_gate|can_access_ats_job|can_view_person|can_manage_person|can_manage_access_scope|workspace_id/i;
const LEGACY_ADMIN_RE = /is_workspace_admin_of\s*\(|resolve_workspace_id\s*\(/i;
const WRITE_CMDS = new Set(["ALL", "UPDATE", "DELETE", "INSERT"]);

/** Tabelas em que "somente o próprio usuário" é o desenho correto (dado pessoal). */
const PERSONAL_BY_DESIGN = new Set([
  "notifications",
  "push_subscriptions",
  "user_grid_preferences",
  "copilot_sessions",
  "copilot_messages",
  "message_drafts",
  "search_recent",
  "search_pinned",
  "chat_conversation_members",
  "chat_messages",
  "chat_message_attachments",
  "user_files",
  "user_file_folders",
  "profiles",
  "api_keys",
  "email_accounts",
  "calendar_accounts",
]);

const MODULES: Array<[RegExp, string]> = [
  [/^ats_|^careers|^job_profiles$/, "TechHire"],
  [/^people(_|$)/, "TechPeople"],
  [/^contract|^esign_|^proposal|^quote/, "TechContracts"],
  [/^project_|^projects$/, "TechProjects"],
  [
    /^financial|^bank_|^nfse|^customer_(invoice|payment)|^dunning|^credit_|^subscription|^recurring_plans$/,
    "TechFinance",
  ],
  [/^ticket|^kb_|^sla_|^macros$|^live_chat|^survey|^playbook/, "TechService"],
  [
    /^deal|^lead|^prospecting|^sdr_|^quotes$|^segments?$|^sequence|^icp_|^whatsapp|^wa_|^score/,
    "TechSales",
  ],
  [
    /^access_|^permission|^job_role|^user_(role|job_role|permission|group)|^workspace|^platform_|^plan|^module/,
    "Plataforma / Acesso",
  ],
  [/^workflow/, "Workflows"],
  [
    /^email_|^unipile|^slack_|^hubspot|^marketplace|^integrations$|^outbound_webhooks$/,
    "Integrações",
  ],
];

function moduleOf(table: string): string {
  for (const [re, mod] of MODULES) if (re.test(table)) return mod;
  return "Core ERP";
}

/* ------------------------------------------------------- classificação por tabela */

type TableAudit = {
  table: string;
  module: string;
  view: View;
  legacyAdmin: boolean;
  personal: boolean;
  restrictiveCreator: string[];
  ownerOnlyWrites: string[];
  wsWrites: string[];
  otherRule: string;
  ruleKind: string;
  routes: string[];
};

/** Qual variante da regra antiga a tabela usa na escrita. */
function ruleKindOf(ps: Policy[], names: string[]): string {
  const txt = ps
    .filter((p) => names.includes(p.name))
    .map((p) => `${p.qual} ${p.check}`)
    .join(" ");
  const kinds: string[] = [];
  if (/workspace_owner_id\s*=\s*auth\.uid\(\)/.test(txt)) kinds.push("somente dono do workspace");
  if (/is_workspace_admin_of\s*\(/.test(txt)) kinds.push("admin pela verificação antiga");
  if (/EXISTS\s*\(/i.test(txt)) kinds.push("herda do registro pai");
  if (/\b(owner_id|created_by)\s*=\s*auth\.uid\(\)/.test(txt)) kinds.push("criador do registro");
  if (/\b(user_id|actor_id|sender_user_id|member_user_id)\s*=\s*auth\.uid\(\)/.test(txt))
    kinds.push("próprio usuário");
  return kinds.length > 0 ? [...new Set(kinds)].join("; ") : "—";
}

function otherRuleLabel(ps: Policy[]): string {
  const txt = ps.map((p) => `${p.qual} ${p.check}`).join(" ");
  const labels: string[] = [];
  if (/^\s*false\s*$/.test(ps[0]?.qual ?? "") || /\bfalse\b/.test(txt))
    labels.push("negação total");
  if (/is_platform_admin/.test(txt)) labels.push("somente administrador de plataforma");
  if (/token/i.test(txt)) labels.push("acesso por token público");
  if (/auth\.uid\(\)\s*=\s*id|id\s*=\s*auth\.uid\(\)/.test(txt)) labels.push("próprio perfil");
  if (/service_role/.test(ps.map((p) => p.roles).join(","))) labels.push("somente serviço interno");
  if (/anon/.test(ps.map((p) => p.roles).join(","))) labels.push("leitura pública (anon)");
  if (labels.length === 0) {
    const first = ps.find((p) => (p.qual || p.check || "").trim().length > 0);
    const snippet = (first?.qual || first?.check || "")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "\\|")
      .trim()
      .slice(0, 160);
    labels.push(snippet ? `condição própria: \`${snippet}\`` : "sem condição legível");
  }
  return [...new Set(labels)].join("; ");
}

function classify(table: string, ps: Policy[], routes: string[]): TableAudit {
  const restrictive = ps.filter((p) => p.permissive === "RESTRICTIVE");
  const writes = ps.filter((p) => WRITE_CMDS.has(p.cmd));
  const expr = (p: Policy) => `${p.qual} ${p.check}`;

  const restrictiveCreator = restrictive.filter((p) => OWNER_RE.test(expr(p))).map((p) => p.name);
  const ownerOnlyWrites = writes
    .filter((p) => OWNER_RE.test(expr(p)) && !WS_RE.test(expr(p)))
    .map((p) => p.name);
  const wsWrites = writes.filter((p) => WS_RE.test(expr(p))).map((p) => p.name);
  const trivial =
    ps.length > 0 &&
    ps.every((p) => ["true", ""].includes(p.qual.trim()) && ["true", ""].includes(p.check.trim()));

  let view: View;
  if (restrictiveCreator.length > 0) view = "1a";
  else if (ownerOnlyWrites.length > 0 && wsWrites.length === 0) view = "1b";
  else if (ps.length === 0 || trivial) view = "3";
  else if (wsWrites.length > 0 || ps.some((p) => WS_RE.test(expr(p)))) view = "2";
  else view = "4";

  return {
    table,
    module: moduleOf(table),
    view,
    legacyAdmin: ps.some((p) => LEGACY_ADMIN_RE.test(expr(p))),
    personal: PERSONAL_BY_DESIGN.has(table),
    restrictiveCreator,
    ownerOnlyWrites,
    wsWrites,
    otherRule: view === "4" ? otherRuleLabel(ps) : "",
    ruleKind: ruleKindOf(ps, restrictiveCreator.length > 0 ? restrictiveCreator : ownerOnlyWrites),
    routes,
  };
}

/* --------------------------------------------------------------- coleta de dados */

function loadPolicies(): Map<string, Policy[]> {
  const rows = psql(
    `select tablename, policyname, permissive, cmd, array_to_string(roles,','),
            replace(coalesce(qual,''), chr(10), ' '),
            replace(coalesce(with_check,''), chr(10), ' ')
       from pg_policies where schemaname='public' order by tablename, policyname`,
  );
  const map = new Map<string, Policy[]>();
  for (const [table, name, permissive, cmd, roles, qual, check] of rows) {
    const list = map.get(table) ?? [];
    list.push({
      table,
      name,
      permissive: permissive as Policy["permissive"],
      cmd,
      roles,
      qual,
      check,
    });
    map.set(table, list);
  }
  return map;
}

function loadTables(): string[] {
  return psql(`select tablename from pg_tables where schemaname='public' order by 1`).map(
    (r) => r[0],
  );
}

/** Arquivos locais importados por um arquivo (aliases `@/` e caminhos relativos). */
function localImports(file: string): string[] {
  let src = "";
  try {
    src = readFileSync(resolve(ROOT, file), "utf8");
  } catch {
    return [];
  }
  const specs = [...src.matchAll(/from\s+["']([^"']+)["']|import\(["']([^"']+)["']\)/g)]
    .map((m) => m[1] ?? m[2])
    .filter((s): s is string => !!s && (s.startsWith("@/") || s.startsWith(".")));
  const out: string[] = [];
  for (const spec of specs) {
    const base = spec.startsWith("@/")
      ? resolve(ROOT, "src", spec.slice(2))
      : resolve(dirname(resolve(ROOT, file)), spec);
    for (const cand of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ]) {
      if (existsSync(cand) && statSync(cand).isFile()) {
        out.push(relative(ROOT, cand).replaceAll("\\", "/"));
        break;
      }
    }
  }
  return out;
}

function routePath(file: string): string {
  return (
    file
      .replace(/^src\/routes/, "")
      .replace(/\.tsx?$/, "")
      .replace(/\/index$/, "/")
      .replace(/\$/g, ":")
      .replace(/\/\([^)]*\)/g, "")
      .replace(/^\/_authenticated/, "")
      .replace(/\./g, "/") || "/"
  );
}

/**
 * Mapeia tabela -> telas (rotas), seguindo o grafo de imports a partir de cada rota.
 * Um arquivo de `src/lib` ou `src/components` alcançado pela rota conta como origem dela.
 */
function loadRoutes(tables: string[]): Map<string, string[]> {
  const hits = rg(String.raw`from\(["'](\w+)["']\)`, ["-o", "--replace", "$1", "-g", "src/**"]);
  const fileByTable = new Map<string, Set<string>>();
  for (const line of hits) {
    const m = /^(.*?):\d+:(\w+)$/.exec(line);
    if (!m) continue;
    const [, file, table] = m;
    if (!fileByTable.has(table)) fileByTable.set(table, new Set());
    fileByTable.get(table)!.add(file);
  }

  const routeFiles = sh("rg", ["--files", "src/routes"])
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith("routeTree.gen.ts"));

  const importCache = new Map<string, string[]>();
  const imports = (f: string): string[] => {
    let v = importCache.get(f);
    if (!v) {
      v = localImports(f);
      importCache.set(f, v);
    }
    return v;
  };

  // rotas alcançáveis por arquivo
  const routesByFile = new Map<string, Set<string>>();
  for (const routeFile of routeFiles) {
    const route = routePath(routeFile);
    const seen = new Set<string>([routeFile]);
    const queue = [routeFile];
    let depth = 0;
    while (queue.length > 0 && depth < 4) {
      const level = queue.splice(0, queue.length);
      for (const f of level) {
        if (!routesByFile.has(f)) routesByFile.set(f, new Set());
        routesByFile.get(f)!.add(route);
        for (const dep of imports(f)) {
          if (seen.has(dep)) continue;
          seen.add(dep);
          queue.push(dep);
        }
      }
      depth += 1;
    }
  }

  const map = new Map<string, string[]>();
  for (const t of tables) {
    const files = [...(fileByTable.get(t) ?? [])];
    const routes = new Set<string>();
    for (const f of files) for (const r of routesByFile.get(f) ?? []) routes.add(r);
    // Prioriza rotas cujo caminho contém um termo do nome da tabela (as telas do domínio).
    const terms = t.split("_").filter((w) => w.length > 3);
    const rank = (r: string) => (terms.some((w) => r.includes(w) || r.includes(`${w}s`)) ? 0 : 1);
    const ui = [...routes]
      .filter((r) => !r.startsWith("/api/"))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const api = [...routes].filter((r) => r.startsWith("/api/")).sort();
    const list = ui.length > 0 ? ui : api;
    if (list.length > 0) {
      const picked = list.slice(0, 6);
      map.set(t, list.length > 6 ? [...picked, `+${list.length - 6}`] : picked);
      continue;
    }
    // Nenhuma rota alcança a tabela: uso interno (jobs, webhooks, engines).
    map.set(
      t,
      files
        .sort()
        .slice(0, 3)
        .map((f) => `\`${f}\``),
    );
  }
  return map;
}

/* ------------------------------------------------- varredura de checagens no código */

function codeFindings(): { creator: string[]; writesWithoutGate: string[] } {
  const creator = [
    ...rg(String.raw`\.eq\("(owner_id|created_by)", *(user|userId|u)\b`),
    ...rg(String.raw`(owner_id|created_by|member_user_id)\s*===\s*(user\?\.id|user\.id|userId)`),
    ...rg(String.raw`\bisOwner\b`),
  ]
    .filter((l) => !/\.test\.tsx?:/.test(l))
    .sort();

  const gated = new Set(
    rg(
      String.raw`assertPermission|assertAnyPermission|assertWorkflows|assertImportEntity|user_can_act`,
      ["-l"],
    ),
  );
  const writers = rg(String.raw`\.(delete|update)\(`, ["-l", "-g", "src/lib/**"]);
  const writesWithoutGate = writers.filter((f) => !gated.has(f)).sort();
  return { creator, writesWithoutGate };
}

/* ------------------------------------------------------------------- relatório md */

function table(rows: string[][], head: string[]): string {
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function main(): void {
  const tables = loadTables();
  const policies = loadPolicies();
  const routes = loadRoutes(tables);
  const audits = tables.map((t) => classify(t, policies.get(t) ?? [], routes.get(t) ?? []));
  const { creator, writesWithoutGate } = codeFindings();

  const byView = (v: View) => audits.filter((a) => a.view === v);
  const routeCell = (a: TableAudit) => (a.routes.length ? a.routes.join("<br>") : "—");

  const md: string[] = [];
  md.push("# Auditoria de regras de acesso — criador/administrador vs. workspace/permissão");
  md.push("");
  md.push(
    `> Gerado por \`bun run audit:access\` (${new Date().toISOString().slice(0, 10)}).\n> Não editar à mão: regenerar o arquivo após qualquer migração que altere policies.`,
  );
  md.push("");
  md.push("## Como ler");
  md.push("");
  md.push(
    [
      "- **Visão 1a** — regra RESTRICTIVE de criador/administrador: aplicada em AND, então bloqueia até quem tem permissão de workspace. É o caso crítico.",
      "- **Visão 1b** — escrita apenas para o criador, sem nenhuma alternativa por permissão.",
      "- **Visão 2** — regra baseada em workspace e/ou permissão (modelo oficial).",
      "- **Visão 3** — tabela sem regra própria (catálogo global).",
      "- **Visão 4** — outra regra; a regra é citada na linha.",
      "- Coluna *legado* marca uso de `is_workspace_admin_of` / `resolve_workspace_id` (verificação antiga de administrador).",
      "- Coluna *pessoal* marca dado por usuário, em que restringir ao próprio usuário é correto por desenho.",
    ].join("\n"),
  );
  md.push("");
  md.push("## Resumo");
  md.push("");
  md.push(
    table(
      (["1a", "1b", "2", "3", "4"] as View[]).map((v) => [
        v,
        String(byView(v).length),
        String(byView(v).filter((a) => a.personal).length),
      ]),
      ["Visão", "Áreas", "das quais pessoais por desenho"],
    ),
  );
  md.push("");
  md.push(`Total de áreas (tabelas) analisadas: **${audits.length}**.`);
  md.push("");

  md.push("## Visão 1a — regra obrigatória de criador/administrador (crítico)");
  md.push("");
  md.push(
    table(
      byView("1a").map((a) => [
        a.module,
        `\`${a.table}\``,
        routeCell(a),
        a.ruleKind,
        a.restrictiveCreator.join("<br>"),
        a.legacyAdmin ? "sim" : "não",
        a.wsWrites.length
          ? `${a.wsWrites.length} policy(ies) de workspace coexistem`
          : "sem alternativa",
      ]),
      [
        "Módulo",
        "Área",
        "Tela / rota",
        "Tipo de regra",
        "Policies restritivas",
        "Legado",
        "Observação",
      ],
    ),
  );
  md.push("");

  md.push("## Visão 1b — escrita somente para o criador (sem alternativa por permissão)");
  md.push("");
  md.push(
    table(
      byView("1b").map((a) => [
        a.module,
        `\`${a.table}\``,
        routeCell(a),
        a.ruleKind,
        a.ownerOnlyWrites.slice(0, 4).join("<br>"),
        a.personal ? "pessoal (correto por desenho)" : "revisar",
      ]),
      ["Módulo", "Área", "Tela / rota", "Tipo de regra", "Policies de criador", "Classificação"],
    ),
  );
  md.push("");

  md.push("## Visão 2 — workspace / permissão (modelo oficial)");
  md.push("");
  md.push(
    table(
      byView("2").map((a) => [
        a.module,
        `\`${a.table}\``,
        routeCell(a),
        a.legacyAdmin ? "usa verificação antiga de admin" : "—",
      ]),
      ["Módulo", "Área", "Tela / rota", "Ressalva"],
    ),
  );
  md.push("");

  md.push("## Visão 3 — sem regra própria");
  md.push("");
  md.push(
    table(
      byView("3").map((a) => [a.module, `\`${a.table}\``, routeCell(a)]),
      ["Módulo", "Área", "Tela / rota"],
    ),
  );
  md.push("");

  md.push("## Visão 4 — outra regra");
  md.push("");
  md.push(
    table(
      byView("4").map((a) => [a.module, `\`${a.table}\``, routeCell(a), a.otherRule]),
      ["Módulo", "Área", "Tela / rota", "Regra"],
    ),
  );
  md.push("");

  md.push("## Ação recomendada por área (visões 1a e 1b)");
  md.push("");
  md.push(
    table(
      [...byView("1a"), ...byView("1b")]
        .filter((a) => !a.personal)
        .map((a) => [
          a.module,
          `\`${a.table}\``,
          a.view,
          a.view === "1a"
            ? "Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`."
            : "Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces.",
        ]),
      ["Módulo", "Área", "Visão", "Ação"],
    ),
  );
  md.push("");
  md.push(
    "Áreas marcadas como pessoais por desenho ficam fora da correção: restringir ao próprio usuário é o comportamento esperado.",
  );
  md.push("");

  md.push("## Checagens de criador feitas no código (independem das policies)");
  md.push("");
  md.push("```text");
  md.push(...creator);
  md.push("```");
  md.push("");
  md.push(
    `## Módulos com escrita em \`src/lib\` sem gate explícito de permissão (${writesWithoutGate.length})`,
  );
  md.push("");
  md.push(
    "Lista para triagem: a ausência de `assertPermission` não é erro quando a policy de workspace já cobre a operação.",
  );
  md.push("");
  md.push("```text");
  md.push(...writesWithoutGate);
  md.push("```");
  md.push("");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${md.join("\n")}\n`);
  process.stdout.write(`${OUT}\n`);
}

main();
