import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Authorization helpers are the correctness-critical logic in this codebase;
    // coverage is reported against them specifically, not the UI.
    coverage: {
      provider: "v8",
      include: ["src/lib/auth/**", "src/lib/data/**"],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real package throws outside Next's "react-server" condition. Its
      // guarantee is enforced at build time, so a no-op is correct here.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
