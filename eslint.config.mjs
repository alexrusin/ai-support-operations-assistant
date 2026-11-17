import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

// Code health rules. They follow the function-level and module-level smells
// in CodeScene's Code Health model. The limits are common starting values,
// not CodeScene's own thresholds. Make them stricter as the code allows.
const codeHealth = {
  files: ["**/*.{js,mjs,cjs,ts}"],
  plugins: { sonarjs },
  rules: {
    // Complex method
    complexity: ["error", 10],
    "sonarjs/cognitive-complexity": ["error", 15],

    // Deep nesting
    "max-depth": ["error", 3],
    "max-nested-callbacks": ["error", 3],
    "sonarjs/no-nested-conditional": "error",
    "sonarjs/no-nested-functions": ["error", { threshold: 4 }],

    // Large method and large file
    "max-lines-per-function": [
      "error",
      { max: 60, skipBlankLines: true, skipComments: true },
    ],
    "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    "max-statements": ["error", 20],

    // Many arguments
    "max-params": ["error", 4],

    // Complex conditional
    "sonarjs/expression-complexity": ["error", { max: 3 }],
    "sonarjs/no-collapsible-if": "error",
    "sonarjs/no-inverted-boolean-check": "error",
    "sonarjs/max-switch-cases": ["error", 10],

    // Duplication inside one file (jscpd checks across files)
    "sonarjs/no-identical-functions": "error",
    "sonarjs/no-duplicated-branches": "error",
    "sonarjs/no-all-duplicated-branches": "error",
  },
};

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  codeHealth,
  globalIgnores(["dist/**", "coverage/**", "src/generated/**"]),
]);
