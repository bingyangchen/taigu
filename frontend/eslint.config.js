import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "build/", "dist/"] },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...js.configs.recommended },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...react.configs.flat.recommended },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...reactHooks.configs["recommended-latest"] },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...jsxA11y.flatConfigs.recommended },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...importPlugin.flatConfigs.recommended },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...importPlugin.flatConfigs.typescript },
  { files: ["src/**/*.{js,jsx,ts,tsx}"], ...prettierConfig },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.es2021, ...globals.node },
    },
    plugins: { "@typescript-eslint": tsPlugin, "simple-import-sort": simpleImportSort },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error",
      "no-redeclare": "error",
      "no-constant-condition": "error",
      "no-empty": "error",
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-inner-declarations": "error",
      "no-irregular-whitespace": "error",
      "no-obj-calls": "error",
      "no-sparse-arrays": "error",
      "no-unreachable": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-extra-boolean-cast": "error",
      "no-prototype-builtins": "error",

      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/prop-types": "off", // We're using TypeScript
      "react/jsx-uses-react": "off", // Not needed in React 17+
      "react/jsx-uses-vars": "error",
      "react/jsx-no-target-blank": "error",
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-unknown-property": "error",
      "react/require-render-return": "error",
      "react/display-name": "error",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        // Rewriting `a ? a : b` or `if (!a) a = b` with `??` changes the result when `a`
        // is "" or 0, so keep the scope the rule had before typescript-eslint 8.
        { ignoreTernaryTests: true, ignoreIfStatements: true },
      ],
      "@typescript-eslint/prefer-optional-chain": "error",

      "no-console": "off",
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",

      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-has-content": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/html-has-lang": "warn",
      "jsx-a11y/iframe-has-title": "warn",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/no-access-key": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-noninteractive-tabindex": "warn",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "jsx-a11y/tabindex-no-positive": "warn",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": "warn",
      "import/default": "error",
      "import/export": "error",
      "import/named": "warn",
      "import/namespace": "error",
      "import/no-named-as-default": "error",
      "import/no-named-as-default-member": "error",
      "import/no-unused-modules": "error",
    },
    settings: {
      react: { version: "detect" },
      "import/core-modules": [
        "@radix-ui/react-dialog",
        "@radix-ui/react-slot",
        "@radix-ui/react-tabs",
        "@radix-ui/react-tooltip",
        "@radix-ui/react-visually-hidden",
      ],
      "import/resolver": { node: { extensions: [".js", ".jsx", ".ts", ".tsx"] } },
      "simple-import-sort": {
        groups: [
          ["^react", "^@react", "^react-"],
          ["^node:"],
          ["^[a-zA-Z]"],
          ["^[./]"],
          ["^@types/"],
        ],
      },
    },
  },
  {
    files: ["src/service-worker.ts"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ["src/**/*.test.tsx"],
    languageOptions: { parserOptions: { project: null } },
    rules: {
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
    },
  },
];
