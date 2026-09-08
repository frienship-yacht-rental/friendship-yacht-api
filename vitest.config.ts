import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", "dist/**"],
    // Keeps the winston console transport quiet while the reporter is running.
    env: { NODE_ENV: "test" },
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "src/server.ts"],
    },
  },
});
