import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["**/*.d.ts"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 90,
        lines: 80,
      },
    },
  },
});
