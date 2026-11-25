import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import Button from "./Button";

test("a waiting button keeps focus and blocks clicks, even when also disabled", () => {
  // A natively disabled button drops focus to <body>, which takes keyboard users
  // out of the dialog the button sits in.
  const handleClick = jest.fn();
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
  userEvent.click(button);
  expect(handleClick).not.toHaveBeenCalled();
});

test("a disabled button that is not waiting is natively disabled", () => {
  render(<Button disabled>送出</Button>);
  expect(screen.getByRole("button", { name: "送出" })).toBeDisabled();
});
