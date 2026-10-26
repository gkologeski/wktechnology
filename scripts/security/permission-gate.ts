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
type Ref = { file: string; symbol: string };
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
function tree(file: string, source: string) {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}
function nodes(root: ts.Node): ts.Node[] {
  const result: ts.Node[] = [];
  const walk = (n: ts.Node) => {
    result.push(n);
    ts.forEachChild(n, walk);
  };
  walk(root);
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
  if (ref.file.endsWith(".sql")) {
    const clean = sqlDeclarations(source);
    const escaped = ref.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `\\b(?:FUNCTION|POLICY|VIEW|TABLE)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${escaped}(?:\\s|\\(|$)`,
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
        if (!c.database?.some((ref) => ref.file === file))
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
export function assertCiWiring(root: string): Finding[] {
  const findings: Finding[] = [];
  const add = (message: string) => findings.push({ code: "ci_wiring", message });
  const pkg = JSON.parse(readSource(root, "package.json"));
  const { load } = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => unknown };
  const ci = load(readSource(root, ".github/workflows/ci.yml")) as {
    on?: Record<string, unknown>;
    jobs?: Record<string, { if?: unknown; steps?: Array<Record<string, unknown>> }>;
  };
  const unit = ci.jobs?.unit,
    steps = unit?.steps ?? [];
  if (pkg.scripts?.["permissions:check"] !== "bun scripts/check-permissions.ts")
    add("permissions:check must invoke the gate CLI");
  const gate = steps.findIndex((s) => s.run === "bun run permissions:check");
  const verifyStep = steps.findIndex((s) => s.run === "bun run verify");
  const build = steps.findIndex((s) => s.run === "bun run build");
  const checkout = steps.find((s) => s.uses === "actions/checkout@v4");
  if (
    !ci.on ||
    !("pull_request" in ci.on) ||
    !("push" in ci.on) ||
    unit?.if ||
    gate < 0 ||
    verifyStep <= gate ||
    build <= verifyStep ||
    !checkout ||
    (checkout.with as Record<string, unknown> | undefined)?.["fetch-depth"] !== 0
  )
    add("Unconditional permission gate must precede verify/build with full comparison history");
  if (
    steps
      .slice(0, build + 1)
      .some(
        (s) =>
          s.if ||
          s["continue-on-error"] ||
          (typeof s.run === "string" && /\|\|\s*true|set\s+\+e/.test(s.run)),
      )
  )
    add("Gate, verification and build cannot be optional or ignore failures");
  const sf = tree("verify.mjs", readSource(root, "scripts/verify.mjs"));
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
