import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/database/**/*.test.ts",
      "tests/migration/**/*.test.ts",
      "tests/public-site/**/*.test.ts",
    ],
    environment: "node",
    // The production schema is intentionally comprehensive. One fork keeps the
    // full suite reliable on modest developer machines and CI runners.
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
