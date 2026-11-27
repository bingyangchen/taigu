import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import {
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { expect, test } from "vitest";

import BottomSheet from "./BottomSheet";

const user = userEvent.setup();

let navigate: NavigateFunction = () => {};
let currentHash = "";
let currentPathname = "";

function LocationCapture(): null {
  navigate = useNavigate();
  const location = useLocation();
  currentHash = location.hash;
  currentPathname = location.pathname;
  return null;
}

function SheetWithButtons(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(true);
  const [hashAfterClose, setHashAfterClose] = useState<string | null>(null);
  return (
    <>
      <LocationCapture />
      {hashAfterClose !== null && <p>關閉後的網址片段：{hashAfterClose || "無"}</p>}
      {isOpen && (
        <BottomSheet onClickBackground={() => setIsOpen(false)}>
          {(close) => (
            <>
              <button type="button" onClick={() => setIsOpen(false)}>
                捨棄
              </button>
              <button
                type="button"
                onClick={() => close(() => setHashAfterClose(currentHash))}
              >
                編輯
              </button>
            </>
          )}
        </BottomSheet>
      )}
    </>
  );
}

async function openSheet(): Promise<void> {
  render(
    // An entry below the stock page shows whether the sheet goes back one entry too many.
    <MemoryRouter initialEntries={["/market", "/market/2330"]} initialIndex={1}>
      <SheetWithButtons />
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });
  expect(currentHash).toBe("#!");
}

test("removes its history entry when a caller closes it from a button", async () => {
  await openSheet();
  await user.click(screen.getByRole("button", { name: "捨棄" }));
  await waitFor(() => expect(currentHash).toBe(""));
  expect(currentPathname).toBe("/market/2330");
});

test("Escape closes the sheet and removes its history entry", async () => {
  await openSheet();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "捨棄" })).not.toBeInTheDocument(),
  );
  expect(currentHash).toBe("");
  expect(currentPathname).toBe("/market/2330");
});

test("runs the action after its history entry is gone", async () => {
  await openSheet();
  await user.click(screen.getByRole("button", { name: "編輯" }));
  expect(await screen.findByText("關閉後的網址片段：無")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "捨棄" })).not.toBeInTheDocument();
  expect(currentPathname).toBe("/market/2330");
});

test("Back closes the sheet", async () => {
  await openSheet();
  act(() => navigate(-1));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "捨棄" })).not.toBeInTheDocument(),
  );
  expect(currentHash).toBe("");
  expect(currentPathname).toBe("/market/2330");
});
