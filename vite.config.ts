import { defineConfig } from "vitest/config";

export default defineConfig({
  publicDir: "assets",
  build: {
    outDir: "dist",
    sourcemap: true
  },
  test: {
    environment: "jsdom",
    include: ["tests/rules/**/*.test.ts"]
  }
});
