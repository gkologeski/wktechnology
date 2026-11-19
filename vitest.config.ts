import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
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
