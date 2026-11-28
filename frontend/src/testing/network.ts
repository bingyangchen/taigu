import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * For tests: makes `navigator.onLine` report what the test sets, and sends the event a
 * browser sends when it changes, which is how ACCT-R18 reads the network status.
 */
export function mockNetworkStatus(): {
  isOnline: () => boolean;
  setOnline: (isOnline: boolean) => void;
  setOnlineWithoutEvent: (isOnline: boolean) => void;
} {
  let isOnline = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => isOnline);
  return {
    isOnline: () => isOnline,
    setOnline: (nextIsOnline) => {
      isOnline = nextIsOnline;
      act(() => {
        window.dispatchEvent(new Event(nextIsOnline ? "online" : "offline"));
      });
    },
    setOnlineWithoutEvent: (nextIsOnline) => {
      isOnline = nextIsOnline;
    },
  };
}
