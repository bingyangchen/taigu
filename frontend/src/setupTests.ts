import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Testing Library cleans up on its own only when test globals are enabled.
afterEach(cleanup);

// While waiting for an element, Testing Library advances fake timers only through a
// global `jest`, so `findBy*` would wait forever under Vitest's fake timers.
Object.assign(globalThis, {
  jest: {
    advanceTimersByTime: (milliseconds: number) => vi.advanceTimersByTime(milliseconds),
  },
});

// jsdom does not implement scrolling, and the search lists scroll the highlighted
// option into view. Test files that run in the node environment have no DOM.
if (typeof Element !== "undefined") Element.prototype.scrollIntoView = vi.fn();
