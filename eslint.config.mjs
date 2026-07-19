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
      // The base rule is disabled in favour of the TypeScript-aware one, which
      // understands `import type`.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          // `allowTypeImports` sits on each entry, not at the top level.
          //
          // Type-only imports are erased at compile time — they cannot pull the
          // Prisma client into a bundle, and components legitimately need the
          // generated enums (Role, ChildStatus) to type their props. Value
          // imports stay banned, which is what the boundary is actually about.
          paths: [
            {
              name: "@/lib/db",
              // No exception here: there is no such thing as a harmless
              // type-only import of the live client instance.
              message:
                "Do not query the database from a component. Add a scoped function to src/lib/data/ and call that instead — see docs/architecture.md.",
            },
          ],
          patterns: [
            {
              group: ["**/generated/prisma", "@prisma/client"],
              allowTypeImports: true,
              message:
                "The Prisma client is confined to src/lib/data/. Import types with `import type`, never the client itself. See docs/architecture.md.",
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
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
