// Prerenders the public pages after `vite build`.

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "vite";

const BUILD_DIR = path.resolve("build");
// Inside node_modules, so the SSR bundle resolves the packages it leaves external.
const SSR_DIR = path.resolve("node_modules/.cache/prerender");

// For a tree without <html>, React emits the hoisted <title>, <meta>, and <link> tags
// before the rest of the markup, starting with a preload link for each image.
const LEADING_HEAD_TAGS = /^(?:<title>[^<]*<\/title>|<(?:meta|link)\b[^>]*\/>)*/;
const IMAGE_PRELOAD = /<link rel="preload" as="image"[^>]*\/>/g;

// Matches the tag with the line break and indentation before it.
function makeTagPattern(tag) {
  const element =
    "attribute" in tag
      ? `<${tag.tagName}\\b[^>]*\\b${tag.attribute}="${tag.value}"[^>]*>`
      : `<${tag.tagName}>[^<]*</${tag.tagName}>`;
  return new RegExp(`(?:\\n[ \\t]*)?${element}`, "g");
}

function countMatches(html, pattern) {
  return html.match(pattern)?.length ?? 0;
}

function replaceOnce(html, search, replacement) {
  if (html.split(search).length !== 2) {
    throw new Error(`Expected exactly one ${search} in build/index.html`);
  }
  return html.replace(search, () => replacement);
}

function makePageHtml(template, pageMetaTags, siteOrigin, pagePath, renderedPage) {
  const headTags = renderedPage.match(LEADING_HEAD_TAGS)[0];
  const body = renderedPage.slice(headTags.length);
  let html = template;
  for (const tag of pageMetaTags) html = html.replace(makeTagPattern(tag), "");
  // React adds a preload for every image, so below-the-fold images would compete with
  // the app's scripts, which render the page again anyway.
  html = replaceOnce(html, "</head>", `${headTags.replace(IMAGE_PRELOAD, "")}</head>`);
  html = replaceOnce(html, '<div id="root"></div>', `<div id="root">${body}</div>`);

  const head = html.slice(0, html.indexOf("</head>"));
  const canonical = `<link rel="canonical" href="${siteOrigin}${pagePath}"/>`;
  if (
    countMatches(head, /<title>/g) !== 1 ||
    countMatches(html, /rel="canonical"/g) !== 1
  ) {
    throw new Error(`${pagePath} must have exactly one title and one canonical URL`);
  }
  if (!head.includes(canonical)) {
    throw new Error(
      `${pagePath} must declare ${siteOrigin}${pagePath} as its canonical URL`,
    );
  }
  if (html.includes('name="robots"')) {
    throw new Error(`${pagePath} is public, so it must not carry a robots meta tag`);
  }
  return html;
}

try {
  await build({
    logLevel: "warn",
    build: { ssr: "src/prerender.tsx", outDir: SSR_DIR, copyPublicDir: false },
  });
  const { Env, PAGE_META_TAGS, PRERENDERED_PATHS, renderPage } = await import(
    pathToFileURL(path.join(SSR_DIR, "prerender.js")).href
  );
  const template = await readFile(path.join(BUILD_DIR, "index.html"), "utf8");
  for (const pagePath of PRERENDERED_PATHS) {
    const html = makePageHtml(
      template,
      PAGE_META_TAGS,
      Env.siteOrigin,
      pagePath,
      renderPage(pagePath),
    );
    const outputFile = `${pagePath.slice(1)}.html`;
    await writeFile(path.join(BUILD_DIR, outputFile), html);
    console.log(
      `✔ ${pagePath} -> build/${outputFile} (${Buffer.byteLength(html)} bytes)`,
    );
  }
} finally {
  await rm(SSR_DIR, { recursive: true, force: true });
}
