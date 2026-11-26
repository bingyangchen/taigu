import { render, screen } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { expect, test } from "vitest";

import { useMergedState } from "./useMergedState";

function Price({ price }: { price: number }) {
  const [state, setState, runAfterCommitCallbacks] = useMergedState({
    price: 0,
    priceSeenByCallback: "",
  });
  const priceRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (price === 0) return;
    setState({ price }, () =>
      setState({ priceSeenByCallback: priceRef.current?.textContent ?? "" }),
    );
  }, [price, setState]);
  useLayoutEffect(runAfterCommitCallbacks);
  return (
    <output>
      <span ref={priceRef}>{state.price}</span>/{state.priceSeenByCallback}
    </output>
  );
}

test("a callback set by an effect runs after the commit that renders its update", () => {
  // Pages compute values such as the annualized return in these callbacks from the
  // state they just set, as a class component's setState callback lets them. A
  // callback that runs before the update renders reads the previous state.
  const { rerender } = render(<Price price={0} />);
  rerender(<Price price={7} />);
  expect(screen.getByRole("status")).toHaveTextContent("7/7");
});
