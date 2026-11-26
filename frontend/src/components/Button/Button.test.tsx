import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { expect, test, vi } from "vitest";

import Button from "./Button";

const user = userEvent.setup();

test("a waiting button keeps focus and blocks clicks, even when also disabled", async () => {
  // A natively disabled button drops focus to <body>, which takes keyboard users
  // out of the dialog the button sits in.
  const handleClick = vi.fn();
  const { rerender } = render(<Button onClick={handleClick}>送出</Button>);
  const button = screen.getByRole("button", { name: "送出" });
  button.focus();

  rerender(
    <Button disabled waiting onClick={handleClick}>
      送出
    </Button>,
  );
  expect(button).not.toBeDisabled();
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button).toHaveFocus();
  await user.click(button);
  expect(handleClick).not.toHaveBeenCalled();
});

test("a disabled button that is not waiting is natively disabled", () => {
  render(<Button disabled>送出</Button>);
  expect(screen.getByRole("button", { name: "送出" })).toBeDisabled();
});

test("Enter triggers the latest onClick of a button that can be triggered by Enter", async () => {
  // The keydown listener is registered once on mount, so it must read the props of
  // the latest render rather than the ones it was registered with.
  const firstClick = vi.fn();
  const latestClick = vi.fn();
  const { rerender } = render(
    <Button canTriggerByEnter onClick={firstClick}>
      送出
    </Button>,
  );
  rerender(
    <Button canTriggerByEnter onClick={latestClick}>
      送出
    </Button>,
  );
  await user.keyboard("{Enter}");
  expect(firstClick).not.toHaveBeenCalled();
  expect(latestClick).toHaveBeenCalledTimes(1);

  rerender(
    <Button canTriggerByEnter waiting onClick={latestClick}>
      送出
    </Button>,
  );
  await user.keyboard("{Enter}");
  expect(latestClick).toHaveBeenCalledTimes(1);
});
