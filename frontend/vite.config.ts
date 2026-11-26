/// <reference types="vitest/config" />

import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      // Installed PWAs keep the worker at this URL and scope; a new URL would leave
      // them on the old worker.
      filename: "service-worker.ts",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // The page registers the worker as a classic script.
        rollupFormat: "iife",
        globPatterns: ["index.html", "assets/**/*"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      // Every stylesheet loads the design tokens with `@use "styles" as ds;`.
      scss: { loadPaths: [fileURLToPath(new URL("./src", import.meta.url))] },
    },
  },
  // Module workers, the same as the dev server runs them.
  worker: { format: "es" },
  build: { outDir: "build", sourcemap: false },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // The reverse proxy forwards requests with its upstream name as the Host header.
    allowedHosts: ["frontend"],
    // The browser reaches the dev server through the HTTPS reverse proxy.
    hmr: { clientPort: 443 },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: ["frontend"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/setupTests.ts"],
    // tokens.ts reads the design tokens from this module's :export block.
    css: { include: [/src\/styles\/tokens\.module\.scss$/] },
    // The files scripts/sdd/frontend_scenarios.cjs counts as tests, so every scenario
    // a test claims also runs.
    include: [
      "src/**/__tests__/**/*.{js,jsx,ts,tsx}",
      "src/**/*.{spec,test}.{js,jsx,ts,tsx}",
    ],
    mockReset: true,
  },
});
