import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Returns a ref to `value` from the latest committed render. Timers, async
 * continuations and listeners registered once read it to act on the current props
 * and state, as a class component's `this.props` and `this.state` let them.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
