import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The rules below are not style preferences — they are the structural half of
 * this application's authorization model. See docs/architecture.md.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),

  {
    rules: {
      // Unused vars are usually a sign a check was dropped. `_`-prefix to opt out.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // THE BOUNDARY RULE.
    //
    // Pages, components, actions and route handlers must not touch the database
    // directly. Every read of scoped data goes through src/lib/data/, which
    // resolves permissions via src/lib/auth/scope.ts. Without this, a single
    // forgotten `where` clause in one page leaks another family's photos.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "Do not query the database from a component. Add a scoped function to src/lib/data/ and call that instead — see docs/architecture.md.",
            },
            {
              name: "@/generated/prisma",
              message:
                "Import Prisma types from @/lib/data or @/lib/types, never the client itself, from a component.",
            },
          ],
          patterns: [
            {
              group: ["**/generated/prisma", "@prisma/client"],
              message:
                "The Prisma client is confined to src/lib/data/. See docs/architecture.md.",
            },
          ],
        },
      ],
    },
  },

  {
    // User-supplied content (captions, announcements, names) must never be
    // injected as raw HTML.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react/no-danger": "error",
    },
  },

  {
    // The data layer is the one place allowed to import Prisma, so the
    // restriction above must not apply to it.
    files: ["src/lib/data/**/*.ts", "src/lib/db.ts", "prisma/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
