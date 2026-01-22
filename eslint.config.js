// ESLint Flat Config with Airbnb-style rules for JS/TS in a Node ESM project
// Notes:
// - Uses typescript-eslint and import plugin to approximate Airbnb standards
// - Keeps default exports allowed (common for config files and simple modules)
// - Type-aware rules are limited (no project set) for speed; enable if desired

import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Ignore generated and local work dirs
  {
    ignores: [
      "node_modules/",
      "dist/",
      "archive/",
      "tmp/",
      ".pnpm-store/",
      // Ignore private real configs; we lint only examples
      "config/notion.ts",
      "config/spelling.ts",
    ],
  },

  // Base settings and common rules (apply to all files)
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Core style & safety
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      eqeqeq: ["error", "smart"],
      curly: ["error", "all"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-param-reassign": ["error", { props: false }],
      "no-underscore-dangle": "off",
      "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],

      // Imports (Airbnb-ish)
      "import/newline-after-import": "error",
      "import/no-mutable-exports": "error",
      "import/no-unresolved": "off", // Let TS resolver handle this
      "import/extensions": "off",
      "import/prefer-default-export": "off",
      "import/no-default-export": "off",
      "import/order": [
        "error",
        {
          groups: [
            ["builtin", "external"],
            "internal",
            ["parent", "sibling", "index"],
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
    },
  },

  // Recommended JS rules
  js.configs.recommended,

  // Recommended TS rules (non type-checked for speed)
  ...tseslint.configs.recommended,

  // TypeScript-specific rules and overrides
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // Disable type-aware rules unless parserOptions.project is configured
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-floating-promises": "off",

      // Mirror some base choices for TS files
      "no-use-before-define": "off", // handled by TS
    },
  },
];
