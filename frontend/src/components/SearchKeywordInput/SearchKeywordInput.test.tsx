import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import SearchKeywordInput from "./SearchKeywordInput";

function ControlledSearch({ initialKeyword }: { initialKeyword: string }) {
  const [keyword, setKeyword] = useState(initialKeyword);
  return (
    <SearchKeywordInput
      placeholder="輸入證券代號或名稱"
      keyword={keyword}
      onChange={setKeyword}
    />
  );
}

describe("clear button", () => {
  test("shows only while the field holds a keyword", async () => {
    const user = userEvent.setup();
    render(<ControlledSearch initialKeyword="" />);
    expect(screen.queryByRole("button", { name: "清除搜尋" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "2330");
    expect(screen.getByRole("button", { name: "清除搜尋" })).toBeInTheDocument();
  });

  test("empties the field and leaves the focus in it", async () => {
    // The user clears a keyword to type another, so the caret has to stay put.
    const user = userEvent.setup();
    render(<ControlledSearch initialKeyword="2330" />);
    await user.click(screen.getByRole("button", { name: "清除搜尋" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.queryByRole("button", { name: "清除搜尋" })).not.toBeInTheDocument();
  });
});

describe("dragging the page", () => {
  function dragFrom(
    element: Element,
    from: [number, number],
    to: [number, number],
  ): void {
    fireEvent.touchStart(element, {
      touches: [{ clientX: from[0], clientY: from[1] }],
    });
    fireEvent.touchMove(element, { touches: [{ clientX: to[0], clientY: to[1] }] });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  test("closes the keyboard once the page is dragged", () => {
    // On a phone the keyboard would otherwise stay up while the page scrolls, and
    // the fixed footer would ride up on top of it.
    render(<ControlledSearch initialKeyword="" />);
    screen.getByRole("textbox").focus();
    dragFrom(document.body, [200, 400], [200, 300]);
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  test("closes the keyboard for a quick drag that starts on the field", () => {
    // On iOS a quick pan on a focused field scrolls the page too.
    render(<ControlledSearch initialKeyword="2330" />);
    screen.getByRole("textbox").focus();
    dragFrom(screen.getByRole("textbox"), [200, 400], [200, 300]);
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  test("keeps the keyboard for a tap that barely moves", () => {
    render(<ControlledSearch initialKeyword="" />);
    screen.getByRole("textbox").focus();
    dragFrom(document.body, [200, 400], [200, 395]);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  test("keeps the keyboard for a sideways swipe", () => {
    render(<ControlledSearch initialKeyword="" />);
    screen.getByRole("textbox").focus();
    dragFrom(document.body, [300, 400], [50, 402]);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  test("keeps the keyboard for a drag after a long press on the field", () => {
    // That drag moves the caret on iOS.
    vi.useFakeTimers();
    render(<ControlledSearch initialKeyword="2330" />);
    const input = screen.getByRole("textbox");
    input.focus();
    fireEvent.touchStart(input, { touches: [{ clientX: 200, clientY: 400 }] });
    vi.advanceTimersByTime(600);
    fireEvent.touchMove(input, { touches: [{ clientX: 200, clientY: 300 }] });
    expect(input).toHaveFocus();
  });

  test("keeps the keyboard for a drag that starts on the clear button", () => {
    render(<ControlledSearch initialKeyword="2330" />);
    screen.getByRole("textbox").focus();
    dragFrom(screen.getByRole("button", { name: "清除搜尋" }), [200, 400], [200, 300]);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
});
