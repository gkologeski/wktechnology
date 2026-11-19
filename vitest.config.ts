import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Reuse worker threads while keeping every file isolated and every test enabled.
    pool: "threads",
    isolate: true,
    include: ["src/**/*.test.ts"],
  },
});
