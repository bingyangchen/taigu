import { useCallback, useRef, useState } from "react";

type MergedStateUpdate<T> = Partial<T> | ((state: T) => Partial<T> | null);

/**
 * Holds fields that are updated together, set like a class component's `setState`:
 * a partial object, or an updater that returns one (or null for no change), merges
 * into the state, and `afterCommit` runs after the commit that renders the update.
 *
 * A class component runs these callbacks after `componentDidUpdate`, so the caller
 * passes `runAfterCommitCallbacks` to a `useLayoutEffect` declared after its other
 * layout effects.
 */
export function useMergedState<T extends object>(initialState: T | (() => T)) {
  const [state, setFullState] = useState(initialState);
  const [, setRenderRequestCount] = useState(0);
  const afterCommitCallbacksRef = useRef<(() => void)[]>([]);
  const renderedCallbackCountRef = useRef(0);

  // A render includes every update set before it starts, so only the callbacks
  // registered by then run after its commit. A callback registered later, for example
  // by an effect of that commit, waits for the commit of the next render.
  renderedCallbackCountRef.current = afterCommitCallbacksRef.current.length;

  const setState = useCallback(
    (update: MergedStateUpdate<T>, afterCommit?: () => void): void => {
      setFullState((previous) => {
        const partial = typeof update === "function" ? update(previous) : update;
        return partial === null ? previous : { ...previous, ...partial };
      });
      if (!afterCommit) return;
      afterCommitCallbacksRef.current.push(afterCommit);
      // Renders even when the update leaves the state unchanged, as a class
      // component does, so that the callback runs.
      setRenderRequestCount((count) => count + 1);
    },
    [],
  );

  const runAfterCommitCallbacks = useCallback((): void => {
    const callbacks = afterCommitCallbacksRef.current.splice(
      0,
      renderedCallbackCountRef.current,
    );
    renderedCallbackCountRef.current = 0;
    callbacks.forEach((callback) => callback());
  }, []);

  return [state, setState, runAfterCommitCallbacks] as const;
}
