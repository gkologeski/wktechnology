import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, posix } from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";

/** Prevention gate, not a retrospective security certification. Never updates its baseline. */
export const BASELINE_PATH = "docs/security/permission-baseline.json";
export const CONTRACTS_PATH = "docs/security/permission-contracts.json";
export const CATALOG_PATH = "docs/security/permission-key-catalog.json";
export type Snapshot = { schema_version: 1; source_commit: string; files: Record<string, string> };
type Ref = {
  file: string;
  symbol: string;
  sql_surface?: "function_acl" | "schema_acl" | "trigger_drop";
};
type Evidence = { file: string; name: string };
export type Contract = {
  id: string;
  kind: "business" | "public" | "personal" | "platform" | "service" | "internal" | "presentation";
  files: Record<string, string>;
  resources: string[];
  actions: string[];
  scopes: string[];
  permission_keys: string[];
  rationale: string;
  controls: Ref[];
  database: Ref[];
  tests: Partial<
    Record<
      "allowed" | "missing_permission" | "explicit_deny" | "foreign_workspace" | "inactive_member",
      Evidence
    >
  >;
  exception?: { mechanism: string; boundary: string; revocation: string; review_by: string };
};
export type Finding = { code: string; file?: string; message: string };
export const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const safePath = (p: string) =>
  [...p].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127) &&
  !p.includes("\\") &&
  !p.startsWith("/") &&
  p.split("/").every((x) => x && x !== "." && x !== "..");
export function readSource(root: string, file: string): string {
  if (!safePath(file)) throw Error(`Unsafe relative path: ${file}`);
  let current = root;
  for (const part of file.split("/")) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw Error(`Source symlink refused: ${file}`);
  }
  return readFileSync(current, "utf8");
}
export function isProductionPath(file: string): boolean {
  return (
    /^(?:src\/|drizzle\/migrations\/|supabase\/migrations\/)/.test(file) &&
    /\.(?:[cm]?[jt]sx?|sql|html|vue|svelte)$/.test(file) &&
    !/\.(?:test|spec)\.[jt]sx?$|\.d\.ts$|\.gen\.ts$/.test(file)
  );
}
export function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name),
        file = relative(root, path).split("\\").join("/");
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw Error(`Source symlink refused: ${file}`);
      if (stat.isDirectory()) walk(path);
      else if (isProductionPath(file)) out.push(file);
    }
  };
  for (const dir of ["src", "drizzle/migrations", "supabase/migrations"]) walk(join(root, dir));
  return out.sort();
}
export function snapshot(root: string, commit: string): Snapshot {
  return {
    schema_version: 1,
    source_commit: commit,
    files: Object.fromEntries(
      sourceFiles(root).map((file) => [file, hash(readSource(root, file))]),
    ),
  };
}
// Syntax only: every caller still performs its fresh source/path checks before
// this memo. Never retain findings, permission verdicts, test evidence or metadata.
const AST_MEMO_MAX_FILES = 64;
const AST_MEMO_MAX_SOURCE_UNITS = 2_000_000;
const AST_MEMO_MAX_NODES = 250_000;
const AST_MEMO_MAX_SINGLE_SOURCE_UNITS = 500_000;
const AST_MEMO_MAX_SINGLE_NODES = 100_000;
type AstMemoEntry = {
  source: string;
  kind: ts.ScriptKind;
  sf: ts.SourceFile;
  nodeCount: number;
};
const parsedSources = new Map<string, AstMemoEntry>();
const fullNodeLists = new WeakMap<ts.SourceFile, readonly ts.Node[]>();
let retainedSourceUnits = 0;
let retainedNodes = 0;
function forgetParsedSource(file: string, entry: AstMemoEntry) {
  parsedSources.delete(file);
  retainedSourceUnits -= entry.source.length;
  retainedNodes -= entry.nodeCount;
}
function tree(file: string, source: string) {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const previous = parsedSources.get(file);
  if (previous && previous.kind === kind && previous.source === source) {
    // Refresh only LRU order. The exact text, parser options and parent links match.
    parsedSources.delete(file);
    parsedSources.set(file, previous);
    return previous.sf;
  }
  if (previous) forgetParsedSource(file, previous);
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  // Only full-file traversals are memoized. Overlapping subtree arrays stay fresh.
  const flat = nodes(sf);
  if (source.length > AST_MEMO_MAX_SINGLE_SOURCE_UNITS || flat.length > AST_MEMO_MAX_SINGLE_NODES)
    return sf;
  while (
    parsedSources.size >= AST_MEMO_MAX_FILES ||
    retainedSourceUnits + source.length > AST_MEMO_MAX_SOURCE_UNITS ||
    retainedNodes + flat.length > AST_MEMO_MAX_NODES
  ) {
    const oldest = parsedSources.entries().next().value;
    if (!oldest) break;
    forgetParsedSource(oldest[0], oldest[1]);
  }
  parsedSources.set(file, { source, kind, sf, nodeCount: flat.length });
  retainedSourceUnits += source.length;
  retainedNodes += flat.length;
  return sf;
}
function nodes(root: ts.Node): readonly ts.Node[] {
  if (ts.isSourceFile(root)) {
    const previous = fullNodeLists.get(root);
    if (previous) return previous;
  }
  const result: ts.Node[] = [];
  const walk = (n: ts.Node) => {
    result.push(n);
    ts.forEachChild(n, walk);
  };
  walk(root);
  if (ts.isSourceFile(root)) {
    const readonly = Object.freeze(result);
    fullNodeLists.set(root, readonly);
    return readonly;
  }
  return result;
}
function callName(node: ts.Expression): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
}
function aliases(sf: ts.SourceFile): Map<string, string> {
  const result = new Map<string, string>();
  for (const n of nodes(sf))
    if (ts.isImportSpecifier(n)) result.set(n.name.text, (n.propertyName ?? n.name).text);
  return result;
}
export function features(file: string, source: string) {
  const sf = tree(file, source),
    ns = nodes(sf),
    names = aliases(sf);
  const calls = ns
    .filter(ts.isCallExpression)
    .map((n) => names.get(callName(n.expression) ?? "") ?? callName(n.expression));
  const routes = ns
    .filter(ts.isCallExpression)
    .filter((n) =>
      ["createFileRoute", "createAPIFileRoute", "createRootRoute"].includes(
        names.get(callName(n.expression) ?? "") ?? callName(n.expression) ?? "",
      ),
    )
    .map((n) =>
      n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])
        ? n.arguments[0].text
        : "<dynamic-or-root>",
    );
  const events = ns.some((n) => ts.isJsxAttribute(n) && /^on[A-Z]/.test(n.name.getText(sf)));
  const risky = calls.some((n) =>
    [
      "createServerFn",
      "createFileRoute",
      "createAPIFileRoute",
      "createRootRoute",
      "from",
      "rpc",
      "fetch",
      "mutate",
      "mutateAsync",
      "upload",
      "remove",
      "createSignedUrl",
      "setCookie",
      "setHeader",
    ].includes(n ?? ""),
  );
  return {
    routes,
    serverFunctions: calls.filter((n) => n === "createServerFn").length,
    events,
    risky,
  };
}
/** Mask SQL data/comments, including dollar bodies: declarations in text aren't controls. */
export function sqlDeclarations(source: string): string {
  let out = "",
    i = 0;
  while (i < source.length) {
    if (source.startsWith("--", i)) {
      const end = source.indexOf("\n", i);
      i = end < 0 ? source.length : end;
      out += " ";
    } else if (source.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < source.length && depth) {
        if (source.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (source.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      out += " ";
    } else if (source[i] === "'") {
      i++;
      while (i < source.length) {
        if (source[i++] === "'") {
          if (source[i] === "'") i++;
          else break;
        }
      }
      out += " ";
    } else {
      const dollar = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
      if (dollar) {
        const end = source.indexOf(dollar, i + dollar.length);
        i = end < 0 ? source.length : end + dollar.length;
        out += " ";
      } else out += source[i++];
    }
  }
  return out;
}
export function baselineMatches(
  current: string,
  previous: string | undefined,
  base: string,
  bootstrap: string,
): boolean {
  return previous !== undefined
    ? hash(previous.trim()) === hash(current.trim())
    : base === bootstrap;
}
function bindsControl(
  sf: ts.SourceFile,
  file: string,
  ref: Ref,
  expression: ts.Expression,
): boolean {
  if (ts.isIdentifier(expression) && ref.file === file && expression.text === ref.symbol)
    return true;
  const moduleMatches = (specifier: string) => {
    const base = specifier.startsWith("@/")
      ? "src/" + specifier.slice(2)
      : specifier.startsWith(".")
        ? posix.normalize(posix.join(posix.dirname(file), specifier))
        : "";
    return (
      !!base &&
      [
        base,
        base + ".ts",
        base + ".tsx",
        base + ".js",
        base + "/index.ts",
        base + "/index.tsx",
      ].includes(ref.file)
    );
  };
  for (const n of sf.statements) {
    if (
      !ts.isImportDeclaration(n) ||
      !ts.isStringLiteral(n.moduleSpecifier) ||
      !moduleMatches(n.moduleSpecifier.text)
    )
      continue;
    const bindings = n.importClause?.namedBindings;
    if (
      bindings &&
      ts.isNamedImports(bindings) &&
      ts.isIdentifier(expression) &&
      bindings.elements.some(
        (e) => e.name.text === expression.text && (e.propertyName ?? e.name).text === ref.symbol,
      )
    )
      return true;
    if (
      bindings &&
      ts.isNamespaceImport(bindings) &&
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === bindings.name.text &&
      expression.name.text === ref.symbol
    )
      return true;
  }
  return false;
}
function usesControl(root: string, file: string, ref: Ref): boolean {
  const sf = tree(file, readSource(root, file));
  return nodes(sf).some((n) =>
    ts.isCallExpression(n)
      ? bindsControl(sf, file, ref, n.expression)
      : (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) &&
          (ts.isIdentifier(n.tagName) || ts.isPropertyAccessExpression(n.tagName))
        ? bindsControl(sf, file, ref, n.tagName)
        : false,
  );
}
function serverBoundaries(root: string, file: string, controls: Ref[]): string[] {
  const sf = tree(file, readSource(root, file)),
    names = aliases(sf),
    missing: string[] = [];
  const callsControl = (node: ts.Node) =>
    nodes(node).some(
      (n) =>
        ts.isCallExpression(n) && controls.some((ref) => bindsControl(sf, file, ref, n.expression)),
    );
  for (const n of nodes(sf)) {
    if (!ts.isVariableDeclaration(n) || !n.initializer) continue;
    if (
      nodes(n.initializer).some(
        (x) =>
          ts.isCallExpression(x) &&
          (names.get(callName(x.expression) ?? "") ?? callName(x.expression)) === "createServerFn",
      ) &&
      !callsControl(n.initializer)
    )
      missing.push(n.name.getText(sf));
  }
  const referenced = (n: ts.Node) =>
    nodes(n).some(
      (x) =>
        (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) &&
        controls.some((ref) => bindsControl(sf, file, ref, x)),
    );
  const pipeline = (n: ts.Node) =>
    nodes(n).some(
      (x) =>
        ts.isPropertyAssignment(x) &&
        x.name.getText(sf) === "middleware" &&
        referenced(x.initializer),
    );
  for (const n of nodes(sf)) {
    if (
      !ts.isPropertyAssignment(n) ||
      !/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(n.name.getText(sf).replace(/["']/g, ""))
    )
      continue;
    const handlers = n.parent.parent;
    if (!ts.isPropertyAssignment(handlers) || handlers.name.getText(sf) !== "handlers") continue;
    const server = handlers.parent;
    const inherited =
      ts.isObjectLiteralExpression(server) &&
      server.properties.some(
        (x) =>
          ts.isPropertyAssignment(x) &&
          x.name.getText(sf) === "middleware" &&
          referenced(x.initializer),
      );
    const direct = ts.isIdentifier(n.initializer) && referenced(n.initializer);
    if (!inherited && !direct && !callsControl(n.initializer) && !pipeline(n.initializer))
      missing.push(`HTTP ${n.name.getText(sf)}`);
  }
  return missing;
}
function hasDefinition(root: string, ref: Ref): boolean {
  if (!ref || typeof ref.file !== "string" || typeof ref.symbol !== "string" || !ref.symbol.trim())
    return false;
  const source = readSource(root, ref.file);
  if (ref.sql_surface !== undefined && !ref.file.endsWith(".sql")) return false;
  if (ref.file.endsWith(".sql")) {
    const clean = sqlDeclarations(source);
    const escaped = ref.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // ACL-only migrations change an existing security surface without declaring
    // it again. They require an explicit database-reference subtype; comments,
    // values and dollar bodies have already been masked. This never substitutes
    // for a runtime control definition or the five mandatory denial scenarios.
    if (ref.sql_surface === "function_acl") {
      return new RegExp(
        `(?:^|;)\\s*(?:(?:GRANT|REVOKE)\\s+[^;]+?\\s+ON\\s+FUNCTION\\s+${escaped}\\s*\\([^;]*?\\)\\s+(?:TO|FROM)\\s+[^;]+|ALTER\\s+FUNCTION\\s+${escaped}\\s*\\([^;]*?\\)\\s+OWNER\\s+TO\\s+[^;]+)\\s*(?:;|$)`,
        "i",
      ).test(clean);
    }
    if (ref.sql_surface === "schema_acl") {
      return new RegExp(
        `(?:^|;)\\s*(?:GRANT|REVOKE)\\s+(?:USAGE|CREATE|ALL(?:\\s+PRIVILEGES)?)(?:\\s*,\\s*(?:USAGE|CREATE))*\\s+ON\\s+SCHEMA\\s+${escaped}\\s+(?:TO|FROM)\\s+[^;]+\\s*(?:;|$)`,
        "i",
      ).test(clean);
    }
    if (ref.sql_surface === "trigger_drop") {
      const target = /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/i.exec(
        ref.symbol,
      );
      if (!target) return false;
      const [, schema, table, trigger] = target;
      return new RegExp(
        `(?:^|;)\\s*DROP\\s+TRIGGER\\s+(?:IF\\s+EXISTS\\s+)?${trigger}\\s+ON\\s+${schema}\\.${table}\\s*(?:;|$)`,
        "i",
      ).test(clean);
    }
    if (ref.sql_surface !== undefined) return false;
    return new RegExp(
      `\\b(?:FUNCTION|POLICY|VIEW|TABLE|TYPE)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${escaped}(?:\\s|\\(|$)`,
      "i",
    ).test(clean);
  }
  return nodes(tree(ref.file, source)).some(
    (n) =>
      (ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n) || ts.isClassDeclaration(n)) &&
      n.name &&
      ts.isIdentifier(n.name) &&
      n.name.text === ref.symbol,
  );
}
/** A comment/import/string bearing a guard name is not a runtime binding. */
export function invokes(root: string, file: string, symbol: string): boolean {
  const sf = tree(file, readSource(root, file)),
    names = aliases(sf);
  return nodes(sf).some((n) => {
    if (ts.isCallExpression(n)) {
      const name = callName(n.expression);
      return name === symbol || names.get(name ?? "") === symbol;
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const name = n.tagName.getText(sf);
      return name === symbol || names.get(name) === symbol;
    }
    return false;
  });
}
function testExists(root: string, ref: Evidence): boolean {
  // Same mandatory include as vitest.config.ts. Optional E2E and standalone scripts don't count as executed CI evidence.
  if (!ref || !/^src\/.+\.test\.ts$/.test(ref.file) || !ref.name?.trim()) return false;
  const sf = tree(ref.file, readSource(root, ref.file));
  const imports = new Set<string>(),
    assertions = new Set<string>();
  for (const n of nodes(sf))
    if (
      ts.isImportDeclaration(n) &&
      ts.isStringLiteral(n.moduleSpecifier) &&
      n.moduleSpecifier.text === "vitest"
    ) {
      const bindings = n.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const e of bindings.elements) {
          if (["it", "test"].includes((e.propertyName ?? e.name).text)) imports.add(e.name.text);
          if ((e.propertyName ?? e.name).text === "expect") assertions.add(e.name.text);
        }
    }
  return nodes(sf).some(
    (n) =>
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      imports.has(n.expression.text) &&
      n.arguments[0] &&
      ts.isStringLiteralLike(n.arguments[0]) &&
      n.arguments[0].text === ref.name &&
      n.arguments[1] &&
      (ts.isArrowFunction(n.arguments[1]) || ts.isFunctionExpression(n.arguments[1])) &&
      nodes(n.arguments[1]).some(
        (x) =>
          ts.isCallExpression(x) &&
          ts.isIdentifier(x.expression) &&
          assertions.has(x.expression.text),
      ),
  );
}
export function checkCoverage(
  root: string,
  baseline: Snapshot,
  contracts: Contract[],
  catalog: Set<string>,
  now = new Date(),
  retired: Record<string, { sha256: string; rationale: string }> = {},
): { findings: Finding[]; changed: string[]; counts: Record<string, number> } {
  const findings: Finding[] = [],
    current = snapshot(root, baseline.source_commit),
    changed = Object.keys(current.files).filter((f) => baseline.files[f] !== current.files[f]);
  const add = (code: string, message: string, file?: string) =>
    findings.push({ code, message, ...(file ? { file } : {}) });
  if (baseline.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(baseline.source_commit))
    add("baseline", "Invalid immutable baseline");
  const ids = new Set<string>();
  for (const c of contracts) {
    if (ids.has(c.id) || !c.id?.trim())
      add("contract_id", `Missing or duplicate contract: ${c.id}`);
    ids.add(c.id);
    if (!c.rationale?.trim() || c.rationale.length < 30)
      add("rationale", `${c.id}: explain the real authorization boundary`);
    for (const [file, digest] of Object.entries(c.files ?? {})) {
      if (!safePath(file) || !/^[a-f0-9]{64}$/.test(digest)) {
        add("file_hash", `${c.id}: invalid source/hash`, file);
        continue;
      }
      if (current.files[file] !== digest)
        add("stale_contract", `${c.id}: source changed or disappeared; review the contract`, file);
    }
    if (!Object.keys(c.files ?? {}).length) add("contract_files", `${c.id}: no source files`);
    const kinds = [
      "business",
      "public",
      "personal",
      "platform",
      "service",
      "internal",
      "presentation",
    ];
    if (!kinds.includes(c.kind)) add("kind", `${c.id}: unknown authorization classification`);
    if (c.kind === "presentation") {
      if (c.permission_keys?.length || c.resources?.length)
        add("presentation", `${c.id}: presentation cannot stand in for an authorization contract`);
      for (const file of Object.keys(c.files))
        if (
          /\.sql$/.test(file) ||
          features(file, readSource(root, file)).risky ||
          features(file, readSource(root, file)).events
        )
          add(
            "presentation",
            `${c.id}: action, route or data access needs an authorization contract`,
            file,
          );
      continue;
    }
    if (!c.actions?.length || !c.scopes?.length || !c.resources?.length)
      add("matrix", `${c.id}: resource/action/scope required`);
    if (c.kind === "business" && !c.permission_keys?.length)
      add("keys", `${c.id}: business operation needs catalog keys`);
    for (const key of c.permission_keys ?? [])
      if (!catalog.has(key)) add("unknown_key", `${c.id}: permission absent from catalog: ${key}`);
    for (const key of c.permission_keys ?? []) {
      const parts = key.split("."),
        scope = parts.pop(),
        action = parts.pop(),
        resource = parts.join(".");
      if (
        !c.resources?.includes(resource) ||
        !c.actions?.includes(action ?? "") ||
        !c.scopes?.includes(scope ?? "")
      )
        add("matrix", `${c.id}: key does not match declared resource/action/scope: ${key}`);
    }
    if (c.kind !== "business") {
      const e = c.exception;
      if (
        !e?.mechanism?.trim() ||
        !e.boundary?.trim() ||
        !e.revocation?.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.review_by ?? "") ||
        !Number.isFinite(new Date(e.review_by + "T23:59:59Z").getTime()) ||
        new Date(e.review_by + "T23:59:59Z").toISOString().slice(0, 10) !== e.review_by ||
        new Date(e.review_by + "T23:59:59Z").getTime() < now.getTime()
      )
        add(
          "exception",
          `${c.id}: exception needs mechanism, boundary, revocation and unexpired review date`,
        );
    }
    if (!c.controls?.length) add("controls", `${c.id}: no runtime control`);
    for (const ref of c.controls ?? [])
      if (ref.sql_surface !== undefined)
        add(
          "control_definition",
          `${c.id}: ACL targets are database surfaces, not runtime control definitions`,
          ref.file,
        );
    for (const ref of [...(c.controls ?? []), ...(c.database ?? [])]) {
      try {
        if (!hasDefinition(root, ref))
          add("control_definition", `${c.id}: control symbol not defined: ${ref.symbol}`, ref.file);
      } catch {
        add("control_definition", `${c.id}: control source unavailable`, ref.file);
      }
    }
    for (const file of Object.keys(c.files ?? {})) {
      if (!file.endsWith(".sql"))
        for (const endpoint of serverBoundaries(root, file, c.controls ?? []))
          add(
            "server_boundary",
            `${c.id}: server function lacks its declared runtime boundary: ${endpoint}`,
            file,
          );

      if (file.endsWith(".sql")) {
        // Exceção estreita: migração aplicada que é um bloco vazio (sem DDL/DML)
        // não expõe superfície; migrações são imutáveis e não podem ser reescritas.
        const emptyNoop = /^\s*(?:--[^\n]*\n\s*)*DO\s+\$\$\s*BEGIN\s+END\s*\$\$\s*;?\s*$/i.test(
          readSource(root, file),
        );
        if (!emptyNoop && !c.database?.some((ref) => ref.file === file))
          add(
            "database",
            `${c.id}: new SQL must identify its own protected database surface`,
            file,
          );
      } else if (!c.controls?.some((ref) => usesControl(root, file, ref)))
        add("control_binding", `${c.id}: source does not call/render a declared control`, file);
    }
    if (!c.database?.length)
      add("database", `${c.id}: declare RLS/RPC or explicit inherited database boundary`);
    for (const scenario of [
      "allowed",
      "missing_permission",
      "explicit_deny",
      "foreign_workspace",
      "inactive_member",
    ] as const) {
      try {
        if (!c.tests?.[scenario] || !testExists(root, c.tests[scenario]!))
          add("denial_evidence", `${c.id}: executable mandatory-CI test missing: ${scenario}`);
      } catch {
        add("denial_evidence", `${c.id}: test source missing: ${scenario}`);
      }
    }
    if (new Set(Object.values(c.tests ?? {}).map((t) => `${t.file}#${t.name}`)).size < 5)
      add("denial_evidence", `${c.id}: five distinct scenarios required`);
  }
  for (const file of Object.keys(baseline.files).filter((f) => !current.files[f])) {
    changed.push(file);
    if (file.endsWith(".sql")) add("immutable_migration", "Historical migration removed", file);
    const record = retired[file];
    if (!record || record.sha256 !== baseline.files[file] || record.rationale?.length < 30)
      add(
        "unreviewed_removal",
        "Source removal needs its original hash and authorization impact rationale",
        file,
      );
  }
  for (const file of changed.filter((f) => current.files[f])) {
    if (baseline.files[file] && file.endsWith(".sql"))
      add("immutable_migration", "Historical migration changed: add a new migration", file);
    const matches = contracts.filter((c) => c.files?.[file] === current.files[file]);
    if (matches.length !== 1)
      add(
        "uncovered_source",
        "New/changed source needs exactly one current authorization impact contract",
        file,
      );
  }
  return {
    findings,
    changed,
    counts: {
      baseline_files: Object.keys(baseline.files).length,
      current_files: Object.keys(current.files).length,
      changed_files: changed.length,
      contracts: contracts.length,
      catalog_keys: catalog.size,
    },
  };
}
/** The sharded final job delegates its one fresh scan to the canonical wrapper. */
function aggregatePermissionFirst(sf: ts.SourceFile): boolean {
  const identifier = (node: ts.Node | undefined, name: string) =>
    !!node && ts.isIdentifier(node) && node.text === name;
  const indexZero = (node: ts.Node | undefined, name: string) =>
    !!node &&
    ts.isElementAccessExpression(node) &&
    identifier(node.expression, name) &&
    !!node.argumentExpression &&
    ts.isNumericLiteral(node.argumentExpression) &&
    node.argumentExpression.text === "0";
  const freshCall = (node: ts.Node): node is ts.CallExpression =>
    ts.isCallExpression(node) &&
    identifier(node.expression, "runLogged") &&
    node.arguments.length === 1 &&
    indexZero(node.arguments[0], "STEPS");
  const declaration = (statement: ts.Statement | undefined, name: string) => {
    if (
      !statement ||
      !ts.isVariableStatement(statement) ||
      (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !== ts.NodeFlags.Const ||
      statement.declarationList.declarations.length !== 1
    )
      return undefined;
    const result = statement.declarationList.declarations[0];
    return identifier(result.name, name) ? result : undefined;
  };
  const permissionIndex = sf.statements.findIndex((statement) => {
    const result = declaration(statement, "results")?.initializer;
    return (
      result &&
      ts.isArrayLiteralExpression(result) &&
      result.elements.length === 1 &&
      ts.isAwaitExpression(result.elements[0]) &&
      freshCall(result.elements[0].expression)
    );
  });
  if (permissionIndex < 0 || nodes(sf).filter(freshCall).length !== 1) return false;
  const clauses = (expression: ts.Expression): ts.Expression[] =>
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ? [...clauses(expression.left), ...clauses(expression.right)]
      : [expression];
  const guardIndex = sf.statements.findIndex((statement) => {
    if (!ts.isIfStatement(statement)) return false;
    const guards = clauses(statement.expression);
    return (
      guards.length === 3 &&
      identifier(guards[0], "aggregateInput") &&
      ts.isPropertyAccessExpression(guards[1]) &&
      guards[1].name.text === "ok" &&
      indexZero(guards[1].expression, "results") &&
      ts.isPrefixUnaryExpression(guards[2]) &&
      guards[2].operator === ts.SyntaxKind.ExclamationToken &&
      identifier(guards[2].operand, "interrupted")
    );
  });
  // No intervening statement may overwrite the freshly awaited gate result.
  if (guardIndex !== permissionIndex + 1) return false;
  const guard = sf.statements[guardIndex];
  if (!ts.isIfStatement(guard) || !ts.isBlock(guard.thenStatement)) return false;
  const combined = declaration(guard.thenStatement.statements[0], "combined")?.initializer;
  if (!combined || !ts.isAwaitExpression(combined) || !ts.isCallExpression(combined.expression))
    return false;
  const call = combined.expression;
  if (!identifier(call.expression, "runLogged") || call.arguments.length !== 1) return false;
  const argument = call.arguments[0];
  if (
    !ts.isObjectLiteralExpression(argument) ||
    argument.properties.some((p) => !ts.isPropertyAssignment(p))
  )
    return false;
  const fields = new Map(
    argument.properties
      .filter(ts.isPropertyAssignment)
      .map((p) => [p.name.getText(sf), p.initializer]),
  );
  const name = fields.get("name"),
    cmd = fields.get("cmd"),
    args = fields.get("args");
  if (
    fields.size !== 3 ||
    !name ||
    !ts.isStringLiteralLike(name) ||
    name.text !== "aggregate" ||
    !cmd ||
    !ts.isPropertyAccessExpression(cmd) ||
    !identifier(cmd.expression, "process") ||
    cmd.name.text !== "execPath" ||
    !args ||
    !ts.isArrayLiteralExpression(args) ||
    args.elements.length !== 2 ||
    !ts.isStringLiteralLike(args.elements[0]) ||
    args.elements[0].text !== "scripts/verify-shards.mjs" ||
    !ts.isStringLiteralLike(args.elements[1]) ||
    args.elements[1].text !== ".verification-parts"
  )
    return false;
  // A second, unguarded aggregate cannot hide behind the recognized safe branch.
  return (
    nodes(sf).filter(
      (node) =>
        ts.isCallExpression(node) &&
        identifier(node.expression, "runLogged") &&
        node.arguments.some(
          (arg) =>
            ts.isObjectLiteralExpression(arg) &&
            arg.properties.some(
              (p) =>
                ts.isPropertyAssignment(p) &&
                p.name.getText(sf) === "name" &&
                ts.isStringLiteralLike(p.initializer) &&
                p.initializer.text === "aggregate",
            ),
        ),
    ).length === 1
  );
}

export function assertCiWiring(root: string): Finding[] {
  const findings: Finding[] = [];
  const add = (message: string) => findings.push({ code: "ci_wiring", message });
  const pkg = JSON.parse(readSource(root, "package.json"));
  const { load } = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => unknown };
  const ci = load(readSource(root, ".github/workflows/ci.yml")) as {
    on?: Record<string, unknown>;
    jobs?: Record<
      string,
      Record<string, unknown> & { if?: unknown; steps?: Array<Record<string, unknown>> }
    >;
  };
  const unit = ci.jobs?.unit,
    steps = unit?.steps ?? [];
  if (pkg.scripts?.["permissions:check"] !== "bun scripts/check-permissions.ts")
    add("permissions:check must invoke the gate CLI");
  const gate = steps.findIndex((s) => s.run === "bun run permissions:check");
  const verifyStep = steps.findIndex((s) => s.run === "bun run verify");
  const build = steps.findIndex((s) => s.run === "bun run build");
  const performance = steps.findIndex((s) => s.run === "bun run perf:check");
  const checkout = steps.find((s) => s.uses === "actions/checkout@v4");
  const shardJob = ci.jobs?.verification_shards;
  const sharded = shardJob !== undefined;
  const aggregateEnv = steps[verifyStep]?.env as Record<string, unknown> | undefined;
  if (sharded) {
    const strategy = shardJob.strategy as
      | { "fail-fast"?: unknown; matrix?: Record<string, unknown> }
      | undefined;
    const shardSteps = shardJob.steps ?? [];
    const shardVerify = shardSteps.findIndex((step) => step.run === "bun run verify");
    const shardEnv = shardSteps[shardVerify]?.env as Record<string, unknown> | undefined;
    const shardCheckout = shardSteps.find((step) => step.uses === "actions/checkout@v4");
    const shardUpload = shardSteps.find((step) => step.uses === "actions/upload-artifact@v4");
    const download = steps.find((step) => step.uses === "actions/download-artifact@v4");
    const shardUploadWith = shardUpload?.with as Record<string, unknown> | undefined;
    const downloadWith = download?.with as Record<string, unknown> | undefined;
    const shardCheckoutWith = shardCheckout?.with as Record<string, unknown> | undefined;
    const checkoutWith = checkout?.with as Record<string, unknown> | undefined;
    if (
      unit?.name !== "Full verification and performance" ||
      Object.entries(ci.jobs ?? {}).some(
        ([id, job]) => id !== "unit" && job.name === "Full verification and performance",
      ) ||
      unit?.needs !== "verification_shards" ||
      unit.if !== "${{ always() }}" ||
      unit["continue-on-error"] ||
      shardJob.if !== undefined ||
      shardJob["continue-on-error"] ||
      strategy?.["fail-fast"] !== false ||
      JSON.stringify(strategy.matrix) !== JSON.stringify({ shard: [1, 2, 3, 4] }) ||
      shardVerify < 0 ||
      shardSteps.filter((step) => step.run === "bun run verify").length !== 1 ||
      shardEnv?.VERIFY_SHARD !== "${{ matrix.shard }}/4" ||
      shardEnv.VERIFY_AGGREGATE !== undefined ||
      shardEnv.GOMAXPROCS !== "2" ||
      shardEnv.VITEST_MAX_WORKERS !== "2" ||
      !shardCheckout ||
      shardCheckoutWith?.["fetch-depth"] !== 0 ||
      [shardCheckoutWith, checkoutWith].some(
        (options) =>
          !options ||
          options.ref !== undefined ||
          options.repository !== undefined ||
          options.path !== undefined,
      ) ||
      !shardSteps
        .slice(0, shardVerify)
        .some(
          (step) =>
            step.run === "bunx vitest list --filesOnly --json .verification/test-inventory.json",
        ) ||
      shardSteps
        .slice(0, shardVerify + 1)
        .some(
          (step) =>
            step.if !== undefined ||
            step["continue-on-error"] ||
            (typeof step.run === "string" && /\|\|\s*true|set\s+\+e/.test(step.run)),
        ) ||
      // The first real permission check belongs to verify's timed STEPS[0].
      shardSteps
        .slice(0, shardVerify)
        .some(
          (step) =>
            typeof step.run === "string" && /permissions:check|check-permissions/.test(step.run),
        ) ||
      shardUpload?.if !== "always()" ||
      shardUploadWith?.["include-hidden-files"] !== true ||
      shardUploadWith.name !==
        "verification-shard-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.shard }}" ||
      shardUploadWith.path !== ".verification/" ||
      downloadWith?.pattern !==
        "verification-shard-${{ github.run_id }}-${{ github.run_attempt }}-*" ||
      downloadWith.path !== ".verification-parts" ||
      downloadWith["merge-multiple"] !== false ||
      steps[verifyStep]?.if !== "${{ always() }}" ||
      aggregateEnv?.VERIFY_AGGREGATE !== "1" ||
      aggregateEnv.VERIFY_SHARD !== undefined ||
      aggregateEnv.VERIFY_PREVIOUS_STEPS_OK !== "${{ job.status == 'success' }}" ||
      aggregateEnv.SHARD_JOB_RESULT !== "${{ needs.verification_shards.result }}" ||
      steps.filter((step) => step.run === "bun run verify").length !== 1 ||
      performance <= build ||
      !steps
        .slice(0, verifyStep)
        .some(
          (step) =>
            step.run === "bunx vitest list --filesOnly --json .verification/test-inventory.json",
        )
    )
      add(
        "Two-shard verification must preserve all gates, current-run evidence and an unconditional fail-closed aggregate",
      );
  }
  if (
    !ci.on ||
    !("pull_request" in ci.on) ||
    !("push" in ci.on) ||
    (!sharded && unit?.if !== undefined) ||
    (!sharded && (gate < 0 || verifyStep <= gate)) ||
    (sharded && gate >= 0) ||
    build <= verifyStep ||
    !checkout ||
    (checkout.with as Record<string, unknown> | undefined)?.["fetch-depth"] !== 0
  )
    add("Unconditional permission gate must precede verify/build with full comparison history");
  if (
    steps
      .slice(0, (sharded ? performance : build) + 1)
      .some(
        (s) =>
          (s.if !== undefined &&
            !(sharded && s === steps[verifyStep] && s.if === "${{ always() }}")) ||
          s["continue-on-error"] ||
          (typeof s.run === "string" && /\|\|\s*true|set\s+\+e/.test(s.run)),
      )
  )
    add("Gate, verification and build cannot be optional or ignore failures");
  const sf = tree("verify.mjs", readSource(root, "scripts/verify.mjs"));
  if (sharded && !aggregatePermissionFirst(sf))
    add(
      "Sharded aggregation must await exactly one fresh permission gate before its protected aggregate",
    );
  const declaration = nodes(sf).find(
    (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === "STEPS",
  ) as ts.VariableDeclaration | undefined;
  const first =
    declaration?.initializer && ts.isArrayLiteralExpression(declaration.initializer)
      ? declaration.initializer.elements[0]
      : undefined;
  const fields =
    first && ts.isObjectLiteralExpression(first)
      ? new Map(
          first.properties
            .filter(ts.isPropertyAssignment)
            .map((p) => [p.name.getText(sf), p.initializer]),
        )
      : new Map<string, ts.Expression>();
  const literal = (n?: ts.Expression) => (n && ts.isStringLiteralLike(n) ? n.text : undefined);
  const args = fields.get("args");
  if (
    literal(fields.get("name")) !== "permissions" ||
    literal(fields.get("cmd")) !== "bun" ||
    !args ||
    !ts.isArrayLiteralExpression(args) ||
    literal(args.elements[0]) !== "scripts/check-permissions.ts"
  )
    add("Full verification must start with the real permission gate, not a comment");
  const config = tree("vitest.config.ts", readSource(root, "vitest.config.ts"));
  if (
    !nodes(config).some(
      (n) =>
        ts.isPropertyAssignment(n) &&
        n.name.getText(config) === "include" &&
        ts.isArrayLiteralExpression(n.initializer) &&
        n.initializer.elements.length === 1 &&
        literal(n.initializer.elements[0]) === "src/**/*.test.ts",
    )
  )
    add("Test discovery changed; review mandatory executable evidence");
  return findings;
}
export const projectRoot = resolve(import.meta.dirname, "../..");
