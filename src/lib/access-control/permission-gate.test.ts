import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  checkCoverage,
  assertCiWiring,
  baselineMatches,
  features,
  hash,
  invokes,
  snapshot,
  sqlDeclarations,
  type Contract,
} from "../../../scripts/security/permission-gate";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "permission-gate-"));
  roots.push(root);
  const write = (file: string, source: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), source);
  };
  write("src/guard.ts", "export function requireBoundary(resource: string) { return resource; }");
  write(
    "drizzle/migrations/0000_boundary.sql",
    "CREATE FUNCTION public.guard_row() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;",
  );
  const base = snapshot(root, "faca56d27e3e60bc7609208f97704e3e571abb98");
  const file = "src/routes/_authenticated/new.tsx",
    source =
      'import { requireBoundary as check } from "../../guard"; export function Page(){check("demo.records"); return <div/>;}';
  write(file, source);
  const names = ["allow", "no permission", "deny", "foreign", "inactive"];
  const test = "src/guard.test.ts";
  write(
    test,
    'import { it, expect } from "vitest";\n' +
      names.map((n) => `it(${JSON.stringify(n)},()=>{expect(false).toBe(false);});`).join("\n"),
  );
  const c: Contract = {
    id: "new-route",
    kind: "business",
    files: { [file]: hash(source) },
    resources: ["demo.records"],
    actions: ["view"],
    scopes: ["workspace"],
    permission_keys: ["demo.records.view.workspace"],
    rationale: "Caller-bound authorization at the server and record RLS boundary.",
    controls: [{ file: "src/guard.ts", symbol: "requireBoundary" }],
    database: [{ file: "drizzle/migrations/0000_boundary.sql", symbol: "guard_row" }],
    tests: Object.fromEntries(
      [
        "allowed",
        "missing_permission",
        "explicit_deny",
        "foreign_workspace",
        "inactive_member",
      ].map((k, i) => [k, { file: test, name: names[i] }]),
    ),
  };
  const catalog = new Set(["demo.records.view.workspace"]);
  const run = (contracts: Contract[] = [c]) =>
    checkCoverage(root, base, contracts, catalog, new Date("2026-10-25T12:00:00Z"));
  return { root, write, base, file, source, c, run, catalog, test };
}
describe("mandatory permission impact gate", () => {
  it("accepts current bindings, catalog entries and five executable scenarios", () => {
    expect(fixture().run().findings).toEqual([]);
  });
  it("rejects a new route without a contract", () => {
    expect(
      fixture()
        .run([])
        .findings.some((f) => f.code === "uncovered_source"),
    ).toBe(true);
  });
  it("detects anonymous APIs outside the authenticated route tree", () => {
    const f = fixture();
    f.write(
      "src/routes/api/public/new.ts",
      'export const Route=createFileRoute("/api/public/new")({server:{handlers:{POST:()=>true}}});',
    );
    expect(f.run().findings.some((x) => x.file === "src/routes/api/public/new.ts")).toBe(true);
  });
  it("detects changed actions inside an existing baseline file", () => {
    const f = fixture();
    f.write("src/guard.ts", "export function requireBoundary(){return true;}");
    expect(
      f.run().findings.some((x) => x.code === "uncovered_source" && x.file === "src/guard.ts"),
    ).toBe(true);
  });
  it("detects source changes after the declared review hash", () => {
    const f = fixture();
    f.write(f.file, f.source + "\nconst unreviewed=1;");
    expect(f.run().findings.some((x) => x.code === "stale_contract")).toBe(true);
  });
  it("cannot claim a guard by comment, string or unused import", () => {
    const f = fixture();
    const s =
      'import { requireBoundary } from "../../guard"; // requireBoundary()\nconst text="requireBoundary()";';
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    expect(f.run().findings.some((x) => x.code === "control_binding")).toBe(true);
  });
  it("resolves an imported guard alias used at runtime", () => {
    const f = fixture();
    expect(invokes(f.root, f.file, "requireBoundary")).toBe(true);
  });
  it("rejects unknown permission keys", () => {
    const f = fixture();
    f.c.permission_keys = ["demo.missing.view.workspace"];
    expect(f.run().findings.some((x) => x.code === "unknown_key")).toBe(true);
  });
  it("requires a real database boundary", () => {
    const f = fixture();
    f.c.database = [];
    expect(f.run().findings.some((x) => x.code === "database")).toBe(true);
  });
  it("rejects guard declarations hidden in SQL comments and values", () => {
    const f = fixture();
    f.write(
      "drizzle/migrations/0000_boundary.sql",
      "-- CREATE FUNCTION guard_row()\nSELECT 'CREATE FUNCTION guard_row()';",
    );
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("requires the exact named denial test, not a comment", () => {
    const f = fixture();
    f.write(f.test, '// it("inactive",()=>{expect(false).toBe(false)})');
    expect(f.run().findings.some((x) => x.code === "denial_evidence")).toBe(true);
  });
  it("rejects skipped and empty denial tests", () => {
    const f = fixture();
    f.write(
      f.test,
      'import { it, expect } from "vitest"; it.skip("inactive",()=>{expect(false).toBe(false)}); it("allow",()=>{});',
    );
    expect(
      f.run().findings.filter((x) => x.code === "denial_evidence").length,
    ).toBeGreaterThanOrEqual(5);
  });
  it("does not count an optional E2E or standalone script as mandatory-CI evidence", () => {
    const f = fixture();
    f.c.tests.inactive_member = { file: "tests/optional.spec.ts", name: "inactive" };
    expect(f.run().findings.some((x) => x.code === "denial_evidence")).toBe(true);
  });
  it("requires five distinct scenarios", () => {
    const f = fixture();
    f.c.tests.inactive_member = f.c.tests.allowed;
    expect(f.run().findings.some((x) => x.message.includes("distinct"))).toBe(true);
  });
  it("rejects an expired public exception", () => {
    const f = fixture();
    f.c.kind = "public";
    f.c.permission_keys = [];
    f.c.exception = {
      mechanism: "signed token",
      boundary: "one record",
      revocation: "token revocation",
      review_by: "2026-01-01",
    };
    expect(f.run().findings.some((x) => x.code === "exception")).toBe(true);
  });
  it("requires an explicit mechanism and revocation for service exceptions", () => {
    const f = fixture();
    f.c.kind = "service";
    expect(f.run().findings.some((x) => x.code === "exception")).toBe(true);
  });
  it("presentation cannot hide a new server function or event action", () => {
    const f = fixture();
    const s = "export const x=createServerFn().handler(()=>true);";
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    f.c.kind = "presentation";
    f.c.resources = [];
    f.c.permission_keys = [];
    expect(f.run().findings.some((x) => x.code === "presentation")).toBe(true);
  });
  it("presentation allows a low impact display-only component with rationale", () => {
    const f = fixture();
    const s = "export function Label(){return <span>Texto</span>}";
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    f.c.kind = "presentation";
    f.c.resources = [];
    f.c.permission_keys = [];
    expect(f.run().findings).toEqual([]);
  });
  it("forbids rewriting an old migration even with a new contract", () => {
    const f = fixture();
    f.write(
      "drizzle/migrations/0000_boundary.sql",
      "CREATE FUNCTION public.guard_row() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;",
    );
    expect(f.run().findings.some((x) => x.code === "immutable_migration")).toBe(true);
  });
  it("does not silently allow source removal", () => {
    const f = fixture();
    rmSync(join(f.root, "src/guard.ts"));
    expect(f.run().findings.some((x) => x.code === "unreviewed_removal")).toBe(true);
  });
  it("recognizes aliased route and server function declarations by AST", () => {
    expect(
      features(
        "x.ts",
        'import {createFileRoute as page, createServerFn as fn} from "x";page("/new")({});fn({method:"POST"});',
      ),
    ).toMatchObject({ routes: ["/new"], serverFunctions: 1, risky: true });
  });
  it("does not classify route names in comments as runtime routes", () => {
    expect(
      features("x.ts", '//createFileRoute("/new")\nconst text="createServerFn()";').risky,
    ).toBe(false);
  });
  it("rejects source traversal", () => {
    const f = fixture();
    f.c.controls = [{ file: "../outside.ts", symbol: "requireBoundary" }];
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("masks nested SQL comments and dollar bodies without losing declarations", () => {
    expect(
      sqlDeclarations(
        "/* a /* b */ c */ CREATE FUNCTION x() AS $f$ SELECT 'CREATE FUNCTION y()' $f$; -- z",
      ),
    ).toContain("CREATE FUNCTION x()");
    expect(sqlDeclarations("SELECT 'CREATE FUNCTION y()';")).not.toContain("FUNCTION");
  });
  it("cannot rebaseline reviewed source to hide a regression", () => {
    expect(baselineMatches("changed", "original", "base", "bootstrap")).toBe(false);
    expect(baselineMatches("original", "original", "base", "bootstrap")).toBe(true);
  });
  it("missing comparison history never becomes a green default", () => {
    expect(baselineMatches("baseline", undefined, "unknown", "bootstrap")).toBe(false);
    expect(baselineMatches("baseline", undefined, "bootstrap", "bootstrap")).toBe(true);
  });
  it("a guarded old endpoint cannot cover a new unguarded endpoint in the same file", () => {
    const f = fixture(),
      s =
        'import {requireBoundary} from "../../guard"; const first=createServerFn().middleware([requireBoundary("demo.records")]).handler(()=>true); const unguarded=createServerFn().handler(()=>true);';
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    expect(
      f.run().findings.some((x) => x.code === "server_boundary" && x.message.includes("unguarded")),
    ).toBe(true);
  });
  it("catalog keys must match the declared resource action and scope", () => {
    const f = fixture();
    f.c.actions = ["delete"];
    expect(f.run().findings.some((x) => x.code === "matrix")).toBe(true);
  });
  it("CI comments and optional steps cannot pretend to be the mandatory gate", () => {
    const f = fixture();
    f.write(
      "package.json",
      JSON.stringify({ scripts: { "permissions:check": "bun scripts/check-permissions.ts" } }),
    );
    f.write(
      ".github/workflows/ci.yml",
      "on: [push]\njobs:\n  unit:\n    steps: []\n# fetch-depth: 0\n# bun run permissions:check",
    );
    f.write(
      "scripts/verify.mjs",
      '// name: "permissions", "scripts/check-permissions.ts"\nconst STEPS=[];',
    );
    f.write("vitest.config.ts", '// include: ["src/**/*.test.ts"]');
    expect(assertCiWiring(f.root).length).toBeGreaterThanOrEqual(3);
  });
  it("accepts actual unconditional CI ordering and test discovery", () => {
    const f = fixture();
    f.write(
      "package.json",
      JSON.stringify({ scripts: { "permissions:check": "bun scripts/check-permissions.ts" } }),
    );
    f.write(
      ".github/workflows/ci.yml",
      "on:\n  push:\n  pull_request:\njobs:\n  unit:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n      - run: bun run permissions:check\n      - run: bun run verify\n      - run: bun run build\n",
    );
    f.write(
      "scripts/verify.mjs",
      'const STEPS=[{name:"permissions",cmd:"bun",args:["scripts/check-permissions.ts"]}];',
    );
    f.write("vitest.config.ts", 'const config={test:{include:["src/**/*.test.ts"]}};');
    expect(assertCiWiring(f.root)).toEqual([]);
  });
  it("rejects an invalid exception review date instead of treating NaN as future", () => {
    const f = fixture();
    f.c.kind = "public";
    f.c.permission_keys = [];
    f.c.exception = {
      mechanism: "signed token",
      boundary: "one record",
      revocation: "revoke token",
      review_by: "2026-99-99",
    };
    expect(f.run().findings.some((x) => x.code === "exception")).toBe(true);
  });
  it("rejects a symlink before reading production source", () => {
    const f = fixture();
    symlinkSync(join(f.root, "src/guard.ts"), join(f.root, "src/linked.ts"));
    expect(() => f.run()).toThrow("symlink");
  });
  it("rejects a real CI step configured to ignore permission failures", () => {
    const f = fixture();
    f.write(
      "package.json",
      JSON.stringify({ scripts: { "permissions:check": "bun scripts/check-permissions.ts" } }),
    );
    f.write(
      ".github/workflows/ci.yml",
      "on:\n  push:\n  pull_request:\njobs:\n  unit:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n      - run: bun run permissions:check\n        continue-on-error: true\n      - run: bun run verify\n      - run: bun run build\n",
    );
    f.write(
      "scripts/verify.mjs",
      'const STEPS=[{name:"permissions",cmd:"bun",args:["scripts/check-permissions.ts"]}];',
    );
    f.write("vitest.config.ts", 'const config={test:{include:["src/**/*.test.ts"]}};');
    expect(assertCiWiring(f.root).some((x) => x.message.includes("ignore failures"))).toBe(true);
  });
  it("a guarded HTTP GET cannot cover an unguarded POST in the same route", () => {
    const f = fixture(),
      s =
        'import { requireBoundary } from "../../guard"; export const Route=createFileRoute("/api/example")({server:{handlers:{GET:()=>requireBoundary("demo.records"),POST:()=>true}}});';
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    expect(
      f.run().findings.some((x) => x.code === "server_boundary" && x.message.includes("HTTP POST")),
    ).toBe(true);
  });
  it("accepts a declared route-server middleware shared by HTTP handlers", () => {
    const f = fixture(),
      s =
        'import { requireBoundary } from "../../guard"; export const Route=createFileRoute("/api/example")({server:{middleware:[requireBoundary("demo.records")],handlers:{GET:()=>true,POST:()=>true}}});';
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    expect(f.run().findings).toEqual([]);
  });
  it("cannot substitute another module with a same-name guard", () => {
    const f = fixture(),
      s =
        'import {requireBoundary} from "../../fake"; export function Page(){return requireBoundary("demo.records");}';
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    f.write("src/fake.ts", "export function requireBoundary(){return true;}");
    expect(f.run().findings.some((x) => x.code === "control_binding")).toBe(true);
  });
  it("resolves a namespace guard to its actual declared source", () => {
    const f = fixture(),
      s =
        'import * as permissions from "../../guard"; export function Page(){return permissions.requireBoundary("demo.records");}';
    f.write(f.file, s);
    f.c.files[f.file] = hash(s);
    expect(f.run().findings).toEqual([]);
  });
});
