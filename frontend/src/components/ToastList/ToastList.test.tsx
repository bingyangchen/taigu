import { configureStore } from "@reduxjs/toolkit";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import toast, { pushToast } from "../../redux/slices/ToastSlice";
import type { ToastMessage } from "../../types";
import ToastList from "./ToastList";

// The components barrel loads the app store, which this test does not need.
vi.mock("../../components", () => ({
  RoundButton: ({
    children,
    onClick,
    hint_text: hintText,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    hint_text: string;
  }) => (
    <button type="button" aria-label={hintText} onClick={onClick}>
      {children}
    </button>
  ),
}));

function renderToastList() {
  const store = configureStore({ reducer: { toast } });
  render(
    <Provider store={store}>
      <ToastList />
    </Provider>,
  );
  return {
    push: (message: ToastMessage) =>
      act(async () => {
        await store.dispatch(pushToast(message));
      }),
  };
}

/** Ends the leave animation that a closing toast runs before it is removed. */
function finishLeaving(text: string): void {
  const toastElement = screen.getByText(text).parentElement as HTMLElement;
  // jsdom has a WebkitAnimation style but no AnimationEvent, so React listens for the
  // prefixed event name there.
  fireEvent(toastElement, new Event("webkitAnimationEnd", { bubbles: true }));
}

/** jsdom has no PointerEvent, so the pointer type is set on a plain event. */
function movePointerOnto(element: HTMLElement, pointerType: "mouse" | "touch"): void {
  const event = createEvent.pointerOver(element);
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(element, event);
}

function movePointerOff(element: HTMLElement): void {
  const event = createEvent.pointerOut(element);
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  fireEvent(element, event);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-root"></div>';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("tells assistive technology about successes politely and about errors at once", async () => {
  const { push } = renderToastList();
  await push({ type: "success", text: "備註已更新" });
  await push({ type: "error", text: "沒有連上網路" });
  expect(screen.getByRole("status")).toHaveTextContent("備註已更新");
  expect(screen.getByRole("alert")).toHaveTextContent("沒有連上網路");
  expect(screen.getAllByRole("button", { name: "關閉通知" })).toHaveLength(2);
});

test("closes itself after 5 seconds", async () => {
  const { push } = renderToastList();
  await push({ type: "success", text: "備註已更新" });
  act(() => vi.advanceTimersByTime(5000));
  finishLeaving("備註已更新");
  expect(screen.queryByText("備註已更新")).not.toBeInTheDocument();
});

test("waits while the pointer is on the toast", async () => {
  const { push } = renderToastList();
  await push({ type: "success", text: "備註已更新" });
  act(() => vi.advanceTimersByTime(4000));
  movePointerOnto(screen.getByRole("status"), "mouse");
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("status")).not.toHaveClass(/leaving/);
  movePointerOff(screen.getByRole("status"));
  act(() => vi.advanceTimersByTime(999));
  expect(screen.getByRole("status")).not.toHaveClass(/leaving/);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveClass(/leaving/);
});

test("waits while focus is in the toast", async () => {
  const { push } = renderToastList();
  await push({ type: "error", text: "沒有連上網路" });
  act(() => screen.getByRole("button", { name: "關閉通知" }).focus());
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("alert")).not.toHaveClass(/leaving/);
});

test("closing one toast leaves the others' time alone", async () => {
  const { push } = renderToastList();
  await push({ type: "success", text: "第一則" });
  act(() => vi.advanceTimersByTime(3000));
  await push({ type: "success", text: "第二則" });
  fireEvent.click(screen.getAllByRole("button", { name: "關閉通知" })[0]);
  finishLeaving("第一則");
  expect(screen.queryByText("第一則")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByText("第二則").parentElement).not.toHaveClass(/leaving/);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("第二則").parentElement).toHaveClass(/leaving/);
});

test("a tap on a touch screen does not keep the toast open", async () => {
  const { push } = renderToastList();
  await push({ type: "success", text: "備註已更新" });
  movePointerOnto(screen.getByRole("status"), "touch");
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole("status")).toHaveClass(/leaving/);
});

test("resumes with the time left once focus leaves the toast", async () => {
  const { push } = renderToastList();
  await push({ type: "error", text: "沒有連上網路" });
  act(() => vi.advanceTimersByTime(3000));
  const closeButton = screen.getByRole("button", { name: "關閉通知" });
  act(() => closeButton.focus());
  act(() => vi.advanceTimersByTime(10000));
  act(() => closeButton.blur());
  act(() => vi.advanceTimersByTime(1999));
  expect(screen.getByRole("alert")).not.toHaveClass(/leaving/);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("alert")).toHaveClass(/leaving/);
});

test("the end of the countdown bar's animation does not remove the toast", async () => {
  const { push } = renderToastList();
  await push({ type: "success", text: "備註已更新" });
  fireEvent.click(screen.getByRole("button", { name: "關閉通知" }));
  const timer = screen.getByRole("status").lastElementChild as HTMLElement;
  fireEvent(timer, new Event("webkitAnimationEnd", { bubbles: true }));
  expect(screen.getByText("備註已更新")).toBeInTheDocument();
});
