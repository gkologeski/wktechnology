import { describe, expect, it } from "vitest";
import { BaseSequencer, type TestSpecification, type Vitest } from "vitest/node";
import DatabaseFirstSequencer from "../../../scripts/testing/database-first-sequencer";

// Minimal data-only runner context exercises Vitest's real base sort/shard.
// No test execution, database behavior or authorization decision is simulated.
function context(sizes: Record<string, number> = {}): Vitest {
  return {
    config: { root: "/workspace", shard: { index: 1, count: 2 } },
    cache: {
      getFileTestResults: () => undefined,
      getFileStats: (key: string) => ({ size: sizes[key] ?? 0 }),
    },
  } as unknown as Vitest;
}
function specification(moduleId: string, project = "isolated", pool = "threads", groupOrder = 0) {
  return Object.freeze({
    moduleId,
    project: {
      name: project,
      config: { name: project, sequence: { groupOrder }, isolate: true },
    },
    pool,
    testLines: [17],
    testIds: ["selected-case"],
    testNamePattern: /selected/,
  }) as unknown as TestSpecification;
}

describe("database-first sequencer", () => {
  it("uses the real base order and moves expensive database startup ahead of the tail", async () => {
    const unitLarge = specification("/workspace/unit-large.test.ts");
    const databaseLarge = specification("/workspace/large-postgres.test.ts");
    const unitSmall = specification("/workspace/unit-small.test.ts");
    const databaseSmall = specification("/workspace/connection-postgres.test.ts");
    const ctx = context({
      "isolated:unit-large.test.ts": 600,
      "isolated:large-postgres.test.ts": 400,
      "isolated:unit-small.test.ts": 200,
      "isolated:connection-postgres.test.ts": 100,
    });
    const files = [databaseSmall, unitSmall, databaseLarge, unitLarge];
    expect(await new BaseSequencer(ctx).sort(files)).toEqual([
      unitLarge,
      databaseLarge,
      unitSmall,
      databaseSmall,
    ]);
    expect(await new DatabaseFirstSequencer(ctx).sort(files)).toEqual([
      databaseLarge,
      databaseSmall,
      unitLarge,
      unitSmall,
    ]);
  });

  it("keeps every specification reference and duplicate without mutating the input or metadata", async () => {
    const unit = specification("/workspace/shared.test.ts");
    const database = specification("/workspace/shared-postgres.test.ts");
    const otherProject = specification(database.moduleId, "process-timezone", "forks");
    const files = Object.freeze([unit, database, otherProject, database]);
    const snapshot = [...files];
    const sorted = await new DatabaseFirstSequencer(context()).sort(
      files as unknown as TestSpecification[],
    );
    expect(sorted).toHaveLength(files.length);
    for (const reference of files)
      expect(sorted.filter((item) => item === reference)).toHaveLength(
        files.filter((item) => item === reference).length,
      );
    expect(files).toEqual(snapshot);
    expect(sorted).not.toBe(files);
    expect(otherProject.pool).toBe("forks");
    expect(otherProject.testLines).toEqual([17]);
    expect(otherProject.testIds).toEqual(["selected-case"]);
    expect(otherProject.testNamePattern).toEqual(/selected/);
  });

  it("recognizes database basename tokens on Windows and Unix without matching directory names", async () => {
    const directory = specification("/workspace/postgres/ordinary.test.ts");
    const windows = specification("C:\\workspace\\lib\\permission-postgres-ci.test.ts");
    const unknown = specification("/workspace/postgresql-tooling.test.ts");
    const postgrest = specification("/workspace/postgrest-client.test.ts");
    const postgres = specification("/workspace/postgres.test.ts");
    const other = specification("/workspace/ordinary.test.ts");
    const files = [directory, windows, unknown, postgrest, postgres, other];
    const sorted = await new DatabaseFirstSequencer(context()).sort(files);
    expect(sorted).toEqual([windows, postgrest, postgres, directory, unknown, other]);
  });

  it("prioritizes within explicit project groups without crossing a group boundary", async () => {
    const earlyUnit = specification("/workspace/early.test.ts", "early", "forks", -1);
    const unit = specification("/workspace/unit.test.ts");
    const database = specification("/workspace/db-postgres.test.ts");
    const lateUnit = specification("/workspace/late.test.ts", "late", "forks", 2);
    const lateDatabase = specification("/workspace/late-postgrest.test.ts", "late", "forks", 2);
    const files = [lateUnit, unit, lateDatabase, earlyUnit, database];
    expect(await new DatabaseFirstSequencer(context()).sort(files)).toEqual([
      earlyUnit,
      database,
      unit,
      lateDatabase,
      lateUnit,
    ]);
    expect(files).toEqual([lateUnit, unit, lateDatabase, earlyUnit, database]);
  });

  it.each([
    { paths: [] },
    { paths: ["/workspace/one.test.ts", "/workspace/two.test.ts"] },
    { paths: ["/workspace/one-postgres.test.ts", "/workspace/two-postgrest.test.ts"] },
  ])(
    "preserves the base order when all files belong to one resource group: $paths",
    async ({ paths }) => {
      const files = paths.map((path) => specification(path));
      const ctx = context();
      expect(await new DatabaseFirstSequencer(ctx).sort(files)).toEqual(
        await new BaseSequencer(ctx).sort(files),
      );
    },
  );

  it("inherits real shard selection without adding or dropping selected specifications", async () => {
    const files = [
      specification("/workspace/a.test.ts"),
      specification("/workspace/b-postgres.test.ts"),
      specification("/workspace/c.test.ts"),
      specification("/workspace/d-postgrest.test.ts"),
    ];
    const ctx = context();
    expect(await new DatabaseFirstSequencer(ctx).shard(files)).toEqual(
      await new BaseSequencer(ctx).shard(files),
    );
  });
});
