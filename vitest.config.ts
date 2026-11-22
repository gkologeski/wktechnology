import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import DatabaseFirstSequencer from "./scripts/testing/database-first-sequencer";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Bound disposable database concurrency on developer machines without changing CI coverage.
    maxWorkers: process.env.CI ? undefined : 4,
    sequence: { sequencer: DatabaseFirstSequencer },
    projects: [
      {
        extends: true,
        test: {
          name: "isolated",
          pool: "threads",
          isolate: true,
          include: ["src/**/*.test.ts"],
          exclude: ["src/lib/iso-date.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "process-timezone",
          pool: "forks",
          isolate: true,
          // Node only applies runtime TZ changes reliably to a process's main thread.
          include: ["src/lib/iso-date.test.ts"],
        },
      },
    ],
  },
});
