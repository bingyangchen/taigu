// Prerender public pages into static HTML snapshots after `react-scripts build`.
//
// Serves the build output locally, loads each public route in headless Chrome,
// waits for React to render and PageMeta to sync the document head, then writes
// the snapshot to build/<route>.html. Cloudflare Pages serves `/welcome` from
// `welcome.html` directly (no redirect), so crawlers that do not execute
// JavaScript receive full content and correct per-page metadata, while every
// other path keeps the SPA fallback behavior.

import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const BUILD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../build",
);

const ROUTES = [
  {
    path: "/welcome",
    outputFile: "welcome.html",
    canonical: "https://taigu.tw/welcome",
    marker: "專為台股投資記帳打造",
  },
  {
    path: "/privacy-policy",
    outputFile: "privacy-policy.html",
    canonical: "https://taigu.tw/privacy-policy",
    marker: "隱私權政策",
  },
  {
    path: "/terms-of-service",
    outputFile: "terms-of-service.html",
    canonical: "https://taigu.tw/terms-of-service",
    marker: "服務條款",
  },
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function startServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const filePath = path.join(BUILD_DIR, path.normalize(pathname));
    try {
      const content = await readFile(filePath);
      const mimeType = MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream";
      response.writeHead(200, { "Content-Type": mimeType });
      response.end(content);
    } catch {
      const indexHtml = await readFile(path.join(BUILD_DIR, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(indexHtml);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function prerenderRoute(browser, origin, route) {
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (interceptedRequest) => {
      const url = interceptedRequest.url();
      if (!url.startsWith(origin) || url.startsWith(`${origin}/service-worker.js`)) {
        interceptedRequest.abort();
      } else {
        interceptedRequest.continue();
      }
    });

    await page.goto(`${origin}${route.path}`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
    await page.waitForFunction(
      (expected) =>
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ===
        expected,
      { timeout: 15_000 },
      route.canonical,
    );

    const html = await page.content();
    if (!html.includes(route.marker)) {
      throw new Error(`Rendered HTML is missing expected content "${route.marker}"`);
    }
    if (html.includes('name="robots"')) {
      throw new Error("Rendered HTML unexpectedly contains a robots meta tag");
    }
    await writeFile(path.join(BUILD_DIR, route.outputFile), html);
    console.log(`✔ ${route.path} -> build/${route.outputFile} (${html.length} bytes)`);
  } finally {
    await page.close();
  }
}

const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
try {
  for (const route of ROUTES) {
    await prerenderRoute(browser, origin, route);
  }
} finally {
  await browser.close();
  server.close();
}
