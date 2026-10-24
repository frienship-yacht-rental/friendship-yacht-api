import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", "dist/**"],
    // NODE_ENV keeps the winston console transport quiet while the reporter is
    // running. The rest satisfy the required vars in src/config/env.ts; nothing
    // connects to them, since the pool is lazy and the auth specs mock it out.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "mysql://test:test@127.0.0.1:3306/test",
      BETTER_AUTH_SECRET: "test-only-secret-never-used-outside-vitest",
      BETTER_AUTH_URL: "http://localhost:8000",
      ADMIN_URL: "http://localhost:3000",
    },
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "src/server.ts"],
      thresholds: {
        // A floor to ratchet upward, not a target. Raise as coverage grows.
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
