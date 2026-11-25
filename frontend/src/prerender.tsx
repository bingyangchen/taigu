// Entry of the SSR build that scripts/prerender.mjs runs in Node, so the pages it
// renders must not read browser-only globals while their modules load or render.

import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";

import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService/TermsOfService";
import Welcome from "./pages/Welcome/Welcome";
import { type PrerenderedPath } from "./publicPages";

const pathToPage: Record<PrerenderedPath, ReactElement> = {
  "/welcome": <Welcome />,
  "/privacy-policy": <PrivacyPolicy />,
  "/terms-of-service": <TermsOfService />,
};

export { PAGE_META_TAGS } from "./components/PageMeta/PageMeta";
export { PRERENDERED_PATHS } from "./publicPages";
export { default as Env } from "./utils/env";

export function renderPage(path: PrerenderedPath): string {
  return renderToString(
    <StaticRouter location={path}>{pathToPage[path]}</StaticRouter>,
  );
}
