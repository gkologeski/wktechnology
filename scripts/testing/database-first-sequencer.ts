import { BaseSequencer, type TestSpecification } from "vitest/node";

// Start suites that own disposable database processes before inexpensive files,
// so database startup/cleanup does not become a lone tail on an otherwise idle
// worker. This is only a scheduling hint: collection, sharding, pools, isolation,
// cases and timeouts remain Vitest's. Preserve explicit sequence.groupOrder and
// the base relative order within each resource group.
export default class DatabaseFirstSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const ordered = await super.sort(files);
    const prioritized: TestSpecification[] = [];
    const database: TestSpecification[] = [];
    const other: TestSpecification[] = [];
    let currentGroup: number | undefined;
    for (const specification of ordered) {
      const groupOrder = specification.project.config.sequence.groupOrder ?? 0;
      if (currentGroup !== undefined && groupOrder !== currentGroup) {
        prioritized.push(...database, ...other);
        database.length = 0;
        other.length = 0;
      }
      currentGroup = groupOrder;
      const basename = specification.moduleId.split(/[\\/]/).at(-1) ?? "";
      const group = /(?:^|[-.])(?:postgres|postgrest)(?:[-.])/i.test(basename) ? database : other;
      group.push(specification);
    }
    return [...prioritized, ...database, ...other];
  }
}
