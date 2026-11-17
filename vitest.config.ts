import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: the unit tests don't need the Cloudflare or React
// plugins, and loading the Cloudflare plugin would start a local Workers runtime.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "evals/**/*.test.ts"],
  },
});
