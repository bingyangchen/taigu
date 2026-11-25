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
