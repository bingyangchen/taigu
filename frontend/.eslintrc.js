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
    "no-unused-vars": "warn",
    "no-undef": "warn",
    "no-redeclare": "warn",
    "no-constant-condition": "warn",
    "no-empty": "warn",
    "no-extra-semi": "warn",
    "no-func-assign": "warn",
    "no-inner-declarations": "warn",
    "no-irregular-whitespace": "warn",
    "no-obj-calls": "warn",
    "no-sparse-arrays": "warn",
    "no-unreachable": "warn",
    "use-isnan": "warn",
    "valid-typeof": "warn",
    "no-extra-boolean-cast": "warn",
    "no-prototype-builtins": "warn",

    // React specific rules
    "react/react-in-jsx-scope": "off", // Not needed in React 17+
    "react/prop-types": "off", // We're using TypeScript
    "react/jsx-uses-react": "off", // Not needed in React 17+
    "react/jsx-uses-vars": "warn",
    "react/jsx-no-target-blank": "warn",
    "react/jsx-key": "warn",
    "react/no-unescaped-entities": "warn",
    "react/jsx-no-duplicate-props": "warn",
    "react/jsx-no-undef": "warn",
    "react/no-direct-mutation-state": "warn",
    "react/no-unknown-property": "warn",
    "react/require-render-return": "warn",
    "react/display-name": "warn",

    // React Hooks rules
    "react-hooks/rules-of-hooks": "warn",
    "react-hooks/exhaustive-deps": "warn",

    // TypeScript specific rules
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-var-requires": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "warn",
    "@typescript-eslint/prefer-optional-chain": "warn",

    // General rules
    "no-console": "warn",
    "no-debugger": "warn",
    "prefer-const": "warn",
    "no-var": "warn",

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
    "simple-import-sort/imports": "warn",
    "simple-import-sort/exports": "warn",
    "import/first": "warn",
    "import/newline-after-import": "warn",
    "import/no-duplicates": "warn",
    "import/no-unresolved": "warn",
    "import/default": "warn",
    "import/export": "warn",
    "import/first": "warn",
    "import/named": "warn",
    "import/namespace": "warn",
    "import/no-duplicates": "warn",
    "import/no-named-as-default": "warn",
    "import/no-named-as-default-member": "warn",
    "import/no-unused-modules": "warn",
  },
  settings: {
    react: { version: "detect" },
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
  ignorePatterns: [
    "node_modules/",
    "build/",
    "dist/",
    "*.config.js",
    "*.config.ts",
    ".eslintrc.js",
  ],
};
