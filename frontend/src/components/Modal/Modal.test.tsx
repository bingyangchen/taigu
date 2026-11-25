import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { MemoryRouter, type NavigateFunction, useNavigate } from "react-router-dom";

import { requestCloseActiveModal } from "../../utils/modal";
import Modal from "./Modal";

// Jest 27 cannot resolve the package exports of react-router-dom 7.
jest.mock("react-router-dom", () => {
  Object.assign(globalThis, { TextEncoder: jest.requireActual("util").TextEncoder });
  return jest.requireActual("react-router");
});

// The components barrel and the app router load the store, whose worker URL Jest
// cannot parse.
jest.mock("../../router", () => {
  const { useLocation, useNavigate, useNavigationType } =
    jest.requireActual("react-router");
  return {
    withRouter:
      (Component: React.ComponentType<{ router: object }>) => (props: object) => (
        <Component
          {...props}
          router={{
            location: useLocation(),
            navigationType: useNavigationType(),
            navigate: useNavigate(),
          }}
        />
      ),
  };
});
jest.mock("../../components", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  RoundButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
}));

let navigate: NavigateFunction = () => {};

function NavigateCapture(): null {
  navigate = useNavigate();
  return null;
}

function StackedModals(): React.ReactElement {
  const [isLowerOpen, setIsLowerOpen] = useState(true);
  const [isUpperOpen, setIsUpperOpen] = useState(false);
  return (
    <>
      <NavigateCapture />
      {isLowerOpen && (
        <Modal
          title="下層視窗"
          noFooter
          discardButtonProps={{ onClick: () => setIsLowerOpen(false) }}
        >
          <button type="button" onClick={() => setIsUpperOpen(true)}>
            開啟上層視窗
          </button>
        </Modal>
      )}
      {isUpperOpen && (
        <Modal
          title="上層視窗"
          noFooter
          visualLayer="nested"
          discardButtonProps={{ onClick: () => setIsUpperOpen(false) }}
        />
      )}
    </>
  );
}

async function openStackedModals(): Promise<void> {
  render(
    <MemoryRouter initialEntries={["/records"]}>
      <StackedModals />
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });
  userEvent.click(screen.getByRole("button", { name: "開啟上層視窗" }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });
}

test("Back closes only the modal on top of another modal", async () => {
  await openStackedModals();
  act(() => navigate(-1));
  await waitFor(() => expect(screen.queryByText("上層視窗")).not.toBeInTheDocument());
  expect(screen.getByText("下層視窗")).toBeInTheDocument();
  act(() => navigate(-1));
  await waitFor(() => expect(screen.queryByText("下層視窗")).not.toBeInTheDocument());
});

test("closing every modal reports the history entries they leave", async () => {
  await openStackedModals();
  act(() => navigate(-1));
  await waitFor(() => expect(screen.queryByText("上層視窗")).not.toBeInTheDocument());
  let historyEntryCount = 0;
  await act(async () => {
    historyEntryCount = await requestCloseActiveModal("navigation");
  });
  expect(historyEntryCount).toBe(1);
});
