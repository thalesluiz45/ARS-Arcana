import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` is resolved by the Next.js bundler. In Vitest it would throw
      // unconditionally, so point it at an empty module instead.
      "server-only": path.resolve(process.cwd(), "tests", "server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
