module.exports = {
  env: { browser: true, es2021: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier", // Make sure ESLint doesn't conflict with Prettier
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: "latest",
    sourceType: "module",
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["react", "@typescript-eslint", "jsx-a11y", "import", "simple-import-sort"],
  rules: {
    // Global rule override - ensure all rules are at most warnings
    "eslint-disable": "off",

    // Core ESLint rules - force to warn
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

    // React specific rules
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

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // TypeScript specific rules
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-var-requires": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",

    // General rules
    "no-console": "off",
    "no-debugger": "error",
    "prefer-const": "error",
    "no-var": "error",

    // JSX Accessibility rules - force to warn
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

    // Import rules
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "import/first": "error",
    "import/newline-after-import": "error",
    "import/no-duplicates": "error",
    "import/no-unresolved": "warn",
    "import/default": "error",
    "import/export": "error",
    "import/first": "error",
    "import/named": "warn",
    "import/namespace": "error",
    "import/no-duplicates": "error",
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
        // React and React-related imports
        ["^react", "^@react", "^react-"],
        // Node.js built-ins
        ["^node:"],
        // External packages
        ["^[a-zA-Z]"],
        // Internal imports (relative paths)
        ["^[./]"],
        // Type imports
        ["^@types/"],
      ],
    },
  },
  overrides: [{ files: ["src/service-worker.ts"], env: { serviceworker: true } }],
  ignorePatterns: [
    "node_modules/",
    "build/",
    "dist/",
    "*.config.js",
    "*.config.ts",
    ".eslintrc.js",
  ],
};
