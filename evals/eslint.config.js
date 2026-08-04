import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import love from "eslint-config-love";
import oxlint from "eslint-plugin-oxlint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

const OFF = 0;
const WARN = 1;
const ERROR = 2;

export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // @ts-expect-error Type incompatibility between @typescript-eslint/utils re-exported types and defineConfig.
  // This is a known issue with plugins using TSESLint.FlatConfig types.
  // See: https://github.com/typescript-eslint/typescript-eslint/issues/11543
  love,
  sonarjs.configs?.["recommended"],
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": ERROR,
      "simple-import-sort/exports": ERROR,
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@eslint-community/eslint-comments/disable-enable-pair": ERROR,
      "@typescript-eslint/consistent-type-imports": [
        ERROR,
        {
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": OFF,
      "@typescript-eslint/no-deprecated": ERROR,
      "@typescript-eslint/no-magic-numbers": [
        ERROR,
        {
          ignoreTypeIndexes: true,
        },
      ],
      "@typescript-eslint/no-misused-promises": [
        ERROR,
        {
          checksVoidReturn: false,
        },
      ],
      "@typescript-eslint/no-namespace": [
        ERROR,
        {
          allowDeclarations: true,
        },
      ],
      "@typescript-eslint/only-throw-error": ERROR,
      "@typescript-eslint/prefer-destructuring": [
        ERROR,
        {
          array: false,
          object: true,
        },
        {
          /**
           * We disable this for renamed properties, since code like the following should be valid:
           *
           * ```ts
           * const someSpecificMyEnum = MyEnum.Value1;
           * ```
           */
          enforceForRenamedProperties: false,
        },
      ],
      "@typescript-eslint/return-await": [ERROR, "in-try-catch"],
      "arrow-body-style": OFF,
      eqeqeq: [
        ERROR,
        "always",
        {
          null: "ignore",
        },
      ],
      "import/newline-after-import": ERROR,
      // The runner's stdout progress lines and stderr suite errors are
      // contracts pinned by the orchestration tests; `love` errors on
      // console usage, but here console IS the product surface.
      "no-console": OFF,
      // Spawning `git` off PATH is how the harness samples repo state; the
      // agent itself now runs via the Agent SDK's bundled binary.
      "sonarjs/no-os-command-from-path": OFF,
      /**
       * Disabled because the `v` flag requires es2024, but our project targets es2023.
       * Re-enable when the project upgrades to es2024.
       * @see https://eslint.org/docs/latest/rules/require-unicode-regexp
       */
      "require-unicode-regexp": OFF,
      "sonarjs/no-commented-code": WARN,
      "sonarjs/todo-tag": WARN,
    },
  },
  {
    files: ["**/*.test.ts"],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,

      // Additive on top of the `recommended` rules spread above. We omit any
      // rule that `recommended` already sets to the same severity.
      //
      // We copied this list from `@epicweb-dev/config`, whose vitest block
      // replaced `recommended` instead of extending it. That package dropped
      // ESLint support, so the list is ours now.

      // Warn instead of error, and no autofix: we want a leftover `.only`
      // visible in review, and a fix would delete it while someone debugs.
      "vitest/no-focused-tests": [
        WARN,
        {
          fixable: false,
        },
      ],

      // Use the matcher that names the assertion, so the failure message says
      // which comparison broke.
      "vitest/prefer-comparison-matcher": ERROR,
      "vitest/prefer-equality-matcher": ERROR,
      "vitest/prefer-to-be": ERROR,
      "vitest/prefer-to-contain": ERROR,
      "vitest/prefer-to-have-length": ERROR,

      // Our addition: a `vi.mock` factory must import the module it replaces,
      // since Vitest hoists the factory above outer bindings.
      "vitest/prefer-import-in-mock": ERROR,
    },
  },
  globalIgnores(["node_modules/"]),
  oxlint.buildFromOxlintConfigFile("./.oxlintrc.json", {
    typeAware: true,
  }),
);
