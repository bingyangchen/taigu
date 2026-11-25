// The service worker imports this module, so keep it free of other imports.
export const PRERENDERED_PATHS = [
  "/welcome",
  "/privacy-policy",
  "/terms-of-service",
] as const;

export type PrerenderedPath = (typeof PRERENDERED_PATHS)[number];
