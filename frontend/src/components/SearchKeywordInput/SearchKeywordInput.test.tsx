import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";

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
