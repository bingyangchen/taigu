// Keeps components on the design tokens in src/styles/ (see "Design Token" in
// docs/specs/architecture.md). Only src/styles/tokens/ defines raw values.

import { fileURLToPath } from "node:url";

import * as sass from "sass";

const SRC_DIR = fileURLToPath(new URL("./src", import.meta.url));

// The tokens are emitted by Sass loops, so their names come from the compiled CSS.
function readTokenCustomProperties() {
  const { css } = sass.compile(`${SRC_DIR}/styles/base/index.scss`, {
    loadPaths: [SRC_DIR],
  });
  const names = new Set(css.match(/--[a-z0-9-]+(?=\s*:)/g));
  return Object.fromEntries([...names].map((name) => [name, ""]));
}

const KEYWORDS = ["inherit", "initial", "unset"];
// With expandShorthand, `border`, `outline`, and `background` are checked through
// their color longhands.
const COLOR_PROPERTIES = ["/color$/", "fill", "stroke"];
const SIZE_PROPERTIES = ["font-size", "font-weight", "line-height", "/radius$/"];
const SPACE_PROPERTIES = ["/^(margin|padding)(-.+)?$/", "/^(row-|column-)?gap$/"];

export default {
  extends: ["stylelint-config-standard-scss"],
  plugins: [
    "stylelint-declaration-strict-value",
    "stylelint-value-no-unknown-custom-properties",
  ],
  rules: {
    // Prettier formats the files, and class and keyframe names follow the existing
    // snake_case and camelCase names.
    "selector-class-pattern": null,
    "keyframes-name-pattern": null,
    "rule-empty-line-before": null,
    "at-rule-empty-line-before": null,
    "declaration-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "scss/dollar-variable-empty-line-before": null,
    "scss/double-slash-comment-empty-line-before": null,
    "scss/operator-no-newline-after": null,
    "value-keyword-case": ["lower", { ignoreProperties: ["/^\\$font-family/"] }],
    // Safari before 18 needs the prefix.
    "property-no-vendor-prefix": [
      true,
      { ignoreProperties: ["-webkit-backdrop-filter"] },
    ],
    // CSS Modules' :export and :global.
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["export", "global"] },
    ],
    "property-no-unknown": [true, { ignoreSelectors: [":export"] }],
    "scale-unlimited/declaration-strict-value": [
      [...COLOR_PROPERTIES, ...SIZE_PROPERTIES, ...SPACE_PROPERTIES, "z-index"],
      {
        expandShorthand: true,
        ignoreValues: {
          "/color$/": [...KEYWORDS, "transparent", "currentColor"],
          fill: [...KEYWORDS, "none", "currentColor"],
          stroke: [...KEYWORDS, "none", "currentColor"],
          "font-size": [...KEYWORDS, "0"],
          "font-weight": KEYWORDS,
          "line-height": [...KEYWORDS, "normal"],
          "/radius$/": [...KEYWORDS, "0"],
          "/^(margin|padding)(-.+)?$/": [
            ...KEYWORDS,
            "0",
            "1px",
            "-1px",
            "auto",
            "/^-?[\\d.]+(%|vw|vh|dvh|svh|lvh)$/",
          ],
          "/^(row-|column-)?gap$/": [
            ...KEYWORDS,
            "0",
            "1px",
            "/^[\\d.]+(%|vw|vh|dvh|svh|lvh)$/",
          ],
          // 0 to 3 order an element's own children; anything that covers other
          // page content takes a --z-* token.
          "z-index": [...KEYWORDS, "auto", "/^-?[0-3]$/"],
        },
      },
    ],
    "declaration-property-value-disallowed-list": {
      // Colors take only color tokens. Sizes may also take a component's Sass
      // variable, whose comment says why it is off the scale.
      "/(color|^background|^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?|^outline|^fill|^stroke|^box-shadow)$/":
        ["/\\$[a-z]/"],
      // Durations shorter than 480ms take a --duration-* token.
      "/^(transition|animation)/": [
        "/(^|[\\s,(])([1-9]\\d?|[1-3]\\d{2}|4[0-7]\\d)ms\\b/",
        "/(^|[\\s,(])0?\\.([0-3]\\d*|4([0-7]\\d*)?)s\\b/",
      ],
    },
    // Restyle a primitive from outside its layer instead; see "CSS 的分層" in
    // docs/specs/architecture.md.
    "declaration-no-important": true,
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": [
      "rgb",
      "rgba",
      "hsl",
      "hsla",
      "hwb",
      "color-mix",
      "/^color\\./",
    ],
    "csstools/value-no-unknown-custom-properties": [
      true,
      { importFrom: [{ customProperties: readTokenCustomProperties() }] },
    ],
  },
  overrides: [
    {
      files: ["src/styles/**/*.scss"],
      rules: {
        "scale-unlimited/declaration-strict-value": null,
        "declaration-property-value-disallowed-list": null,
      },
    },
    {
      files: ["src/styles/tokens/**/*.scss"],
      rules: { "color-no-hex": null, "function-disallowed-list": null },
    },
  ],
};
