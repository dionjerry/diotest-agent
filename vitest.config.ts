import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@diotest/domain": path.resolve(__dirname, "packages/domain/src"),
      "@diotest/engine": path.resolve(__dirname, "packages/engine/src"),
      "@diotest/providers": path.resolve(__dirname, "packages/providers/src"),
      "@diotest/renderers": path.resolve(__dirname, "packages/renderers/src"),
    }
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
