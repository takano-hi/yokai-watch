import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: "./src/test/globalSetup.ts",
    setupFiles: ["./src/test/setup.ts"],
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://postgres@localhost:5433/test",
    },
  },
});
