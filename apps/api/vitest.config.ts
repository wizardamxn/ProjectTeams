import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // config.ts validates env at import time; these are the test values.
    env: {
      NODE_ENV: "test",
      JWT_KEY: "test-jwt-key",
      MONGO_URI: "mongodb://unused-in-tests",
      LOG_LEVEL: "silent",
      DNS_SERVERS: "",
    },
    include: ["test/**/*.test.ts"],
    // Integration tests share one in-memory MongoDB, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000, // first run downloads the MongoDB binary
  },
});
