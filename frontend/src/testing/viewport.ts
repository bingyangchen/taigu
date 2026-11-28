// For tests: a window.matchMedia that answers from a viewport the test sets, since
// jsdom has no layout and no matchMedia.

export interface Viewport {
  width: number;
  height: number;
  canHover?: boolean;
  isPWA?: boolean;
}

interface Registration {
  query: string;
  matches: boolean;
  listener: () => void;
}

const FEATURE_PATTERN = /^\((width|height) (<|>=) (\d+)px\)$/u;

function evaluateFeature(feature: string, viewport: Viewport): boolean {
  if (feature === "(hover: hover)") return viewport.canHover ?? true;
  if (feature === "(display-mode: standalone)") return viewport.isPWA ?? false;
  if (feature === "(prefers-reduced-motion: reduce)") return false;
  const match = FEATURE_PATTERN.exec(feature);
  if (!match) throw new Error(`The test viewport cannot evaluate ${feature}`);
  const [, dimension, operator, pixels] = match;
  const size = dimension === "width" ? viewport.width : viewport.height;
  return operator === "<" ? size < Number(pixels) : size >= Number(pixels);
}

function evaluateQuery(query: string, viewport: Viewport): boolean {
  return query.split(",").some((part) =>
    part
      .trim()
      .split(" and ")
      .every((feature) => evaluateFeature(feature.trim(), viewport)),
  );
}

/**
 * Replaces window.matchMedia. `resize` changes the viewport and notifies the change
 * listeners of every query whose result changes, as a browser does.
 */
export function mockViewport(initial: Viewport): {
  resize: (_next: Partial<Viewport>) => void;
} {
  let viewport = initial;
  const registrations = new Set<Registration>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return evaluateQuery(query, viewport);
    },
    media: query,
    addEventListener: (_type: "change", listener: () => void) => {
      registrations.add({ query, matches: evaluateQuery(query, viewport), listener });
    },
    removeEventListener: (_type: "change", listener: () => void) => {
      for (const registration of registrations) {
        if (registration.query === query && registration.listener === listener) {
          registrations.delete(registration);
        }
      }
    },
  })) as unknown as typeof window.matchMedia;

  return {
    resize: (next) => {
      viewport = { ...viewport, ...next };
      for (const registration of registrations) {
        const matches = evaluateQuery(registration.query, viewport);
        if (matches === registration.matches) continue;
        registration.matches = matches;
        registration.listener();
      }
    },
  };
}

export const PHONE_PORTRAIT: Viewport = { width: 390, height: 844, canHover: false };
export const DESKTOP: Viewport = { width: 1280, height: 800, canHover: true };
