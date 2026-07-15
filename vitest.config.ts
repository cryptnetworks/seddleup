import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Integration tests share one SQLite file. Serialize test files so persistent
    // security stores and business transactions cannot contend for its write lock.
    fileParallelism: false,
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});
