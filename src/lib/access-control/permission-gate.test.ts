import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  statSync,
  utimesSync,
  unlinkSync,
  renameSync,
} from "node:fs";
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
const parserCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock("typescript", async (importOriginal) => {
  const actual = await importOriginal<typeof import("typescript")>();
  const compiler = (actual as unknown as { default?: typeof actual }).default ?? actual;
  return {
    ...actual,
    default: {
      ...compiler,
      createSourceFile: (...args: Parameters<typeof compiler.createSourceFile>) => {
        parserCalls.count++;
        return compiler.createSourceFile(...args);
      },
    },
  };
});
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
  it("accepts an explicitly typed existing function ACL surface without pretending it declares a control", () => {
    const f = fixture();
    const file = "drizzle/migrations/0001_acl.sql";
    const source =
      "REVOKE ALL ON FUNCTION public.guard_row() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.guard_row() TO service_role;";
    f.write(file, source);
    f.c.files[file] = hash(source);
    f.c.database.push({ file, symbol: "public.guard_row", sql_surface: "function_acl" });
    expect(f.run().findings).toEqual([]);
  });
  it("inventories an exact top-level trigger retirement as a database surface, never a runtime guard", () => {
    const f = fixture();
    const file = "drizzle/migrations/0001_release.sql";
    const source = "DROP TRIGGER runtime_lock ON public.workflows;";
    f.write(file, source);
    f.c.files[file] = hash(source);
    const ref = {
      file,
      symbol: "public.workflows.runtime_lock",
      sql_surface: "trigger_drop" as const,
    };
    f.c.database.push(ref);
    expect(f.run().findings).toEqual([]);
    f.c.controls.push(ref);
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
    f.c.tests = {};
    expect(
      f
        .run()
        .findings.filter(
          (x) =>
            x.code === "denial_evidence" &&
            x.message.includes("executable mandatory-CI test missing:"),
        ),
    ).toHaveLength(5);
  });
  it.each([
    "public.other.runtime_lock",
    "other.workflows.runtime_lock",
    "public.workflows.other",
    "runtime_lock",
  ])("rejects a trigger retirement with a different target: %s", (symbol) => {
    const f = fixture(),
      file = "drizzle/migrations/0001_release.sql",
      source = "DROP TRIGGER runtime_lock ON public.workflows;";
    f.write(file, source);
    f.c.files[file] = hash(source);
    f.c.database.push({ file, symbol, sql_surface: "trigger_drop" });
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("rejects trigger retirement text hidden in comments, literals or dynamic bodies", () => {
    const f = fixture(),
      file = "drizzle/migrations/0001_release.sql";
    const source =
      "-- DROP TRIGGER runtime_lock ON public.workflows;\nSELECT 'DROP TRIGGER runtime_lock ON public.workflows;'; DO $$ BEGIN EXECUTE 'DROP TRIGGER runtime_lock ON public.workflows;'; END $$;";
    f.write(file, source);
    f.c.files[file] = hash(source);
    f.c.database.push({
      file,
      symbol: "public.workflows.runtime_lock",
      sql_surface: "trigger_drop",
    });
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("accepts a typed schema ACL only for its actual top-level target", () => {
    const f = fixture();
    const file = "drizzle/migrations/0001_acl.sql";
    const source = "REVOKE USAGE ON SCHEMA auth FROM techerp_api_subject;";
    f.write(file, source);
    f.c.files[file] = hash(source);
    f.c.database.push({ file, symbol: "auth", sql_surface: "schema_acl" });
    expect(f.run().findings).toEqual([]);
    f.c.database[f.c.database.length - 1]!.symbol = "private_data";
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("rejects typed ACL claims hidden in comments, data and dynamic dollar bodies", () => {
    const f = fixture();
    const file = "drizzle/migrations/0001_acl.sql";
    const source =
      "-- GRANT EXECUTE ON FUNCTION public.guard_row() TO service_role;\nSELECT 'GRANT EXECUTE ON FUNCTION public.guard_row() TO service_role;'; DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.guard_row() TO service_role;'; END $$;";
    f.write(file, source);
    f.c.files[file] = hash(source);
    f.c.database.push({ file, symbol: "public.guard_row", sql_surface: "function_acl" });
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("never accepts an ACL target as the runtime control or waives the denial evidence", () => {
    const f = fixture();
    f.c.controls.push({
      file: "drizzle/migrations/0000_boundary.sql",
      symbol: "guard_row",
      sql_surface: "function_acl",
    });
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
    f.c.tests = {};
    expect(
      f
        .run()
        .findings.filter(
          (x) =>
            x.code === "denial_evidence" &&
            x.message.includes("executable mandatory-CI test missing:"),
        ),
    ).toHaveLength(5);
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
    // Reviewed four-shard exception keeps the required final job unconditional
    // and fails closed; it must not legalize arbitrary skipped/optional gates.
    const sharded = readFileSync(".github/workflows/ci.yml", "utf8");
    const actualVerify = readFileSync("scripts/verify.mjs", "utf8");
    f.write(".github/workflows/ci.yml", sharded);
    f.write("scripts/verify.mjs", actualVerify);
    expect(assertCiWiring(f.root)).toEqual([]);
    const mutations = [
      (source: string) =>
        source.replace("name: Full verification and performance", "name: Optional verification"),
      (source: string) =>
        source.replace(
          "\n  e2e:\n",
          "\n  alternate:\n    name: Full verification and performance\n    runs-on: ubuntu-latest\n    steps: []\n\n  e2e:\n",
        ),
      (source: string) => source.replace("shard: [1, 2, 3, 4]", "shard: [1]"),
      (source: string) => source.replace("fail-fast: false", "fail-fast: true"),
      (source: string) => source.replace("if: ${{ always() }}", "if: ${{ success() }}"),
      (source: string) => source.replace('VERIFY_AGGREGATE: "1"', 'VERIFY_AGGREGATE: "0"'),
      (source: string) =>
        source.replace(
          "VERIFY_PREVIOUS_STEPS_OK: ${{ job.status == 'success' }}",
          "VERIFY_PREVIOUS_STEPS_OK: true",
        ),
      (source: string) =>
        source.replace(
          "SHARD_JOB_RESULT: ${{ needs.verification_shards.result }}",
          "SHARD_JOB_RESULT: success",
        ),
      (source: string) =>
        source.replace("VERIFY_SHARD: ${{ matrix.shard }}/4", "VERIFY_SHARD: 1/4"),
      (source: string) =>
        source.replace("fetch-depth: 0", "fetch-depth: 0\n          ref: refs/heads/other"),
      (source: string) =>
        source.replace(
          "verification_shards:\n",
          "verification_shards:\n    if: ${{ success() }}\n",
        ),
      (source: string) =>
        source.replace(
          "name: Official help coverage",
          "run: bun run permissions:check\n      - name: Official help coverage",
        ),
      (source: string) =>
        source.replace(
          "      - name: Download all current-run shard proofs",
          "      - run: bun run permissions:check\n      - name: Download all current-run shard proofs",
        ),
      (source: string) =>
        source.replace("run: bun run perf:check", "run: echo optional performance"),
      (source: string) =>
        source.replace("run: bun run perf:check", "run: bun run perf:check\n        if: false"),
      (source: string) =>
        source.replace(
          "run: bun run perf:check",
          "run: bun run perf:check\n        continue-on-error: true",
        ),
    ];
    for (const [index, mutate] of mutations.entries()) {
      const invalid = mutate(sharded);
      expect(invalid).not.toBe(sharded);
      f.write(".github/workflows/ci.yml", invalid);
      expect(assertCiWiring(f.root).length, `sharded CI mutation ${index}`).toBeGreaterThan(0);
    }
    f.write(".github/workflows/ci.yml", sharded);
    const fresh = "const results = [await runLogged(STEPS[0])];";
    const guard = "if (aggregateInput && results[0].ok && !interrupted)";
    const aggregateBlock = actualVerify.slice(
      actualVerify.indexOf(guard),
      actualVerify.indexOf("// Authorization evidence must succeed"),
    );
    const verifyMutations = [
      actualVerify.replace(fresh, "const results = [{ok:true}];"),
      actualVerify.replace(fresh, "const results = [runLogged(STEPS[0])];"),
      actualVerify.replace(
        fresh,
        "const results = [await runLogged(STEPS[0])], overwritten = (results[0] = {ok:true});",
      ),
      actualVerify.replace(fresh, "let results = [await runLogged(STEPS[0])];"),
      actualVerify.replace(
        fresh,
        "const results = aggregateInput ? [{ok:true}] : [await runLogged(STEPS[0])];",
      ),
      actualVerify.replace(guard, "if (aggregateInput)"),
      actualVerify.replace(guard, "results[0] = {ok:true};\n" + guard),
      actualVerify.replace(aggregateBlock, guard + " {}\n"),
      actualVerify.replace(fresh, "") + "\n" + fresh,
      actualVerify.replace('"scripts/verify-shards.mjs"', '"scripts/unreviewed-aggregate.mjs"'),
      actualVerify + "\nawait runLogged(STEPS[0]);",
      actualVerify +
        '\nawait runLogged({name:"aggregate",cmd:process.execPath,args:["scripts/verify-shards.mjs",".verification-parts"]});',
    ];
    for (const [index, invalid] of verifyMutations.entries()) {
      expect(invalid).not.toBe(actualVerify);
      f.write("scripts/verify.mjs", invalid);
      expect(
        assertCiWiring(f.root).some((finding) => finding.message.includes("fresh permission gate")),
        `aggregate permission mutation ${index}`,
      ).toBe(true);
    }
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

describe("process-local syntax memo remains fresh and fail-closed", () => {
  it("re-evaluates same-path same-size source after warming even with an updated review hash", () => {
    const f = fixture();
    expect(f.run().findings).toEqual([]);
    const path = join(f.root, f.file),
      originalStat = statSync(path);
    const changed = f.source.replace('check("demo.records")', 'other("demo.records")');
    expect(changed.length).toBe(f.source.length);
    f.write(f.file, changed);
    utimesSync(path, originalStat.atime, originalStat.mtime);
    f.c.files[f.file] = hash(changed);
    const findings = f.run().findings;
    expect(findings.some((x) => x.code === "stale_contract")).toBe(false);
    expect(findings.some((x) => x.code === "control_binding")).toBe(true);
    f.write(f.file, f.source);
    f.c.files[f.file] = hash(f.source);
    expect(f.run().findings).toEqual([]);
  });
  it("does not reuse a warmed definition after its symbol changes", () => {
    const f = fixture();
    expect(f.run().findings).toEqual([]);
    f.write(
      "src/guard.ts",
      "export function anotherBoundary(resource: string) { return resource; }",
    );
    expect(f.run().findings.some((x) => x.code === "control_definition")).toBe(true);
  });
  it("re-reads named evidence files even though they are outside production snapshots", () => {
    const f = fixture();
    expect(f.run().findings).toEqual([]);
    const original = readFileSync(join(f.root, f.test), "utf8");
    f.write(f.test, original.replace('it("inactive",', 'it.skip("inactive",'));
    expect(f.run().findings.some((x) => x.code === "denial_evidence")).toBe(true);
    f.write(f.test, original);
    expect(f.run().findings).toEqual([]);
  });
  it("does not return a warmed parse before checking a newly introduced source symlink", () => {
    const f = fixture(),
      path = join(f.root, f.file);
    expect(invokes(f.root, f.file, "requireBoundary")).toBe(true);
    unlinkSync(path);
    symlinkSync(join(f.root, "src/guard.ts"), path);
    expect(() => invokes(f.root, f.file, "requireBoundary")).toThrow("symlink");
    expect(() => f.run()).toThrow("symlink");
  });
  it("still checks every parent path component after warming", () => {
    const f = fixture();
    expect(invokes(f.root, f.file, "requireBoundary")).toBe(true);
    const directory = dirname(join(f.root, f.file)),
      moved = directory + "-original";
    renameSync(directory, moved);
    symlinkSync(moved, directory);
    expect(() => invokes(f.root, f.file, "requireBoundary")).toThrow("symlink");
  });
  it("does not turn deletion of warmed source or test evidence into a cached pass", () => {
    const f = fixture();
    expect(f.run().findings).toEqual([]);
    unlinkSync(join(f.root, f.test));
    expect(f.run().findings.some((x) => x.code === "denial_evidence")).toBe(true);
    unlinkSync(join(f.root, f.file));
    expect(() => invokes(f.root, f.file, "requireBoundary")).toThrow();
  });
  it("does not share a binding decision across roots with identical relative filenames", () => {
    const allowed = fixture(),
      denied = fixture();
    expect(allowed.run().findings).toEqual([]);
    const changed = denied.source.replace('check("demo.records")', 'other("demo.records")');
    denied.write(denied.file, changed);
    denied.c.files[denied.file] = hash(changed);
    expect(denied.run().findings.some((x) => x.code === "control_binding")).toBe(true);
    expect(allowed.run().findings).toEqual([]);
  });
  it("preserves the filename-based TS and TSX parser distinction", () => {
    const jsx = "export const View=()=> <button onClick={()=>1}>x</button>;";
    expect(features("kind.tsx", jsx).events).toBe(true);
    expect(features("kind.ts", jsx).events).toBe(false);
    expect(features("kind.tsx", jsx).events).toBe(true);
  });
  it("returns fresh public feature arrays rather than memoized findings", () => {
    const text = 'createFileRoute("/original")({});';
    const first = features("feature.ts", text);
    first.routes.push("/caller-injected");
    expect(features("feature.ts", text).routes).toEqual(["/original"]);
  });
  it("re-evaluates contract metadata, catalog and exception time with unchanged source", () => {
    const f = fixture();
    expect(f.run().findings).toEqual([]);
    f.catalog.clear();
    expect(f.run().findings.some((x) => x.code === "unknown_key")).toBe(true);
    f.catalog.add("demo.records.view.workspace");
    f.c.actions = ["delete"];
    expect(f.run().findings.some((x) => x.code === "matrix")).toBe(true);
    f.c.actions = ["view"];
    f.c.kind = "public";
    f.c.permission_keys = [];
    f.c.exception = {
      mechanism: "signed record token",
      boundary: "one contract record",
      revocation: "revoke the record token",
      review_by: "2027-01-01",
    };
    expect(f.run().findings).toEqual([]);
    expect(
      checkCoverage(
        f.root,
        f.base,
        [f.c],
        f.catalog,
        new Date("2027-01-02T00:00:00Z"),
      ).findings.some((x) => x.code === "exception"),
    ).toBe(true);
  });
  it("keeps syntax behavior after eviction pressure and oversized uncached inputs", () => {
    const guarded = 'createFileRoute("/kept")({});';
    expect(features("first.ts", guarded).risky).toBe(true);
    for (let i = 0; i < 256; i++)
      expect(features(`pressure-${i}.ts`, `const x${i}=${i};`).risky).toBe(false);
    expect(features("first.ts", guarded).routes).toEqual(["/kept"]);
    expect(features("first.ts", 'const text="createFileRoute";').risky).toBe(false);
    const prefix = "/*" + "x".repeat(600_000) + "*/\n";
    expect(
      features("oversized.tsx", prefix + "const View=()=> <button onClick={()=>1}/>;").events,
    ).toBe(true);
    expect(features("oversized.tsx", prefix + "const View=()=> <button/>;").events).toBe(false);
  });
  it("cannot keep CI wiring green after a warmed verify or test-discovery AST changes", () => {
    const f = fixture();
    f.write(
      "package.json",
      JSON.stringify({
        scripts: { "permissions:check": "bun scripts/check-permissions.ts" },
      }),
    );
    f.write(
      ".github/workflows/ci.yml",
      "on:\n  push:\n  pull_request:\njobs:\n  unit:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n      - run: bun run permissions:check\n      - run: bun run verify\n      - run: bun run build\n",
    );
    const verify =
      'const STEPS=[{name:"permissions",cmd:"bun",args:["scripts/check-permissions.ts"]}];';
    f.write("scripts/verify.mjs", verify);
    f.write("vitest.config.ts", 'const config={test:{include:["src/**/*.test.ts"]}};');
    expect(assertCiWiring(f.root)).toEqual([]);
    f.write("scripts/verify.mjs", "const STEPS=[]; // permissions scripts/check-permissions.ts");
    expect(assertCiWiring(f.root).some((x) => x.message.includes("real permission gate"))).toBe(
      true,
    );
    f.write("scripts/verify.mjs", verify);
    f.write("vitest.config.ts", 'const config={test:{include:["src/**/*.spec.ts"]}};');
    expect(assertCiWiring(f.root).some((x) => x.message.includes("discovery changed"))).toBe(true);
  });
});

describe("syntax memo reuse and retention limits", () => {
  it("reuses an exact parser input and reparses every new source generation", () => {
    parserCalls.count = 0;
    const file = "memo-count-reuse.ts",
      first = 'createFileRoute("/one")({});',
      changed = 'createFileRoute("/two")({});';
    expect(features(file, first).routes).toEqual(["/one"]);
    expect(features(file, first).routes).toEqual(["/one"]);
    expect(parserCalls.count).toBe(1);
    expect(features(file, changed).routes).toEqual(["/two"]);
    expect(parserCalls.count).toBe(2);
    expect(features(file, first).routes).toEqual(["/one"]);
    expect(parserCalls.count).toBe(3);
  });
  it("evicts an old filename after the bounded file count is exceeded", () => {
    const first = "memo-limit-files-first.ts",
      text = "const first=1;";
    features(first, text);
    for (let i = 0; i < 64; i++) features(`memo-limit-files-${i}.ts`, `const value${i}=${i};`);
    const before = parserCalls.count;
    features(first, text);
    expect(parserCalls.count).toBe(before + 1);
  });
  it("bounds retained source units even below the file and node count limits", () => {
    const text = "/*" + "x".repeat(150_000) + "*/ const value=1;";
    const first = "memo-limit-source-first.ts";
    features(first, text);
    // Seventeen tiny-node files fit the filename limit, but exceed two million UTF-16 units.
    for (let i = 0; i < 16; i++) features(`memo-limit-source-${i}.ts`, text);
    const before = parserCalls.count;
    features(first, text);
    expect(parserCalls.count).toBe(before + 1);
  });
  it("bounds retained full traversal nodes even below the source and file limits", () => {
    const text = "let value;\n".repeat(8_000),
      first = "memo-limit-nodes-first.ts";
    features(first, text);
    // Each input has >32k nodes but <100k; eleven files use <1m source units.
    for (let i = 0; i < 10; i++) features(`memo-limit-nodes-${i}.ts`, text);
    const before = parserCalls.count;
    features(first, text);
    expect(parserCalls.count).toBe(before + 1);
  });
  it("does not retain an individual source beyond the source-unit cap", () => {
    const text = "/*" + "x".repeat(600_000) + "*/ const value=1;";
    parserCalls.count = 0;
    features("memo-single-source-limit.ts", text);
    features("memo-single-source-limit.ts", text);
    expect(parserCalls.count).toBe(2);
  });
  it("does not retain an individual AST beyond the node cap", () => {
    const text = "let value;\n".repeat(30_000);
    expect(text.length).toBeLessThan(500_000);
    parserCalls.count = 0;
    features("memo-single-node-limit.ts", text);
    features("memo-single-node-limit.ts", text);
    expect(parserCalls.count).toBe(2);
  });
});
