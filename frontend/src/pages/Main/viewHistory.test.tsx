import type { Location, NavigationType } from "react-router-dom";

import { mainTabNavigationState } from "../../utils/mainNavigation";
import { acceptCurrentSession, SESSION_VERSION_KEY } from "../../utils/session";
import {
  captureViewPosition,
  getViewHistory,
  restoreViewPosition,
} from "./viewHistory";

const pop = "POP" as NavigationType;
const push = "PUSH" as NavigationType;

function makeLocation(
  key: string,
  pathname = "/records",
  fields: Partial<Location> = {},
): Location {
  return { key, pathname, search: "", hash: "", state: null, ...fields };
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.removeItem(SESSION_VERSION_KEY);
  acceptCurrentSession();
});

function makeRect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 500,
    width: 500,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

test("keeps position and expanded list state together for each history entry", () => {
  const history = getViewHistory();
  const entry = { top: 1200, anchor: { id: "holding/2330", offset: 36 } };
  const listEntry = makeLocation("list-entry");
  const differentEntry = makeLocation("different-list-entry");
  history.save(listEntry, { position: entry });
  history.save(listEntry, { list: { numberToShow: 60, searchKeyword: "2330" } });
  history.save(differentEntry, { position: { top: 0 } });

  expect(history.get(listEntry, pop)).toEqual({
    position: entry,
    list: { numberToShow: 60, searchKeyword: "2330" },
  });
  expect(history.get(differentEntry, pop)?.position?.top).toBe(0);

  localStorage.setItem(SESSION_VERSION_KEY, "new-account-session");
  acceptCurrentSession();
  expect(history.get(listEntry, pop)).toBeUndefined();
  history.save(differentEntry, { position: entry });
  expect(history.get(differentEntry, pop)).toBeUndefined();
  expect(getViewHistory().get(listEntry, pop)).toBeUndefined();
});

test("resumes only main-tab links from the latest unscoped visit", () => {
  const history = getViewHistory();
  const earlier = makeLocation("earlier");
  const manual = makeLocation("manual", "/records", { state: mainTabNavigationState });
  const filtered = makeLocation("stock-link", "/records", { search: "?sid=2330" });
  const modal = makeLocation("modal", "/records", { hash: "##" });
  const list = { numberToShow: 60, searchKeyword: "台積電" };

  expect(history.get(manual, push)).toBeUndefined();
  history.save(earlier, { position: { top: 400 } });
  history.save(modal, { position: { top: 1200 } });
  history.save(modal, { list });
  history.save(filtered, { position: { top: 1900 }, list: { numberToShow: 15 } });

  expect(history.get(manual, push)).toEqual({ position: { top: 1200 }, list });
  expect(history.get(earlier, pop)?.position?.top).toBe(400);
  expect(history.get(manual, pop)).toBeUndefined();
  expect(history.get(filtered, pop)?.position?.top).toBe(1900);
  expect(history.get(filtered, push)).toBeUndefined();
  expect(history.get(earlier, push)).toBeUndefined();
  expect(
    history.get(
      makeLocation("first-market", "/market", { state: mainTabNavigationState }),
      push,
    ),
  ).toBeUndefined();

  localStorage.setItem(SESSION_VERSION_KEY, "new-account-session");
  acceptCurrentSession();
  expect(history.get(manual, push)).toBeUndefined();
});

test("remembers a focused visible row relative to the scroll container", () => {
  const content = document.createElement("div");
  const visibleRow = document.createElement("button");
  const focusedRow = document.createElement("button");
  visibleRow.dataset.scrollAnchor = "holding/2330";
  focusedRow.dataset.scrollAnchor = "holding/2454";
  Object.defineProperty(content, "clientHeight", { value: 800 });
  jest.spyOn(content, "getBoundingClientRect").mockReturnValue(makeRect(80, 800));
  jest.spyOn(visibleRow, "getBoundingClientRect").mockReturnValue(makeRect(65, 60));
  jest.spyOn(focusedRow, "getBoundingClientRect").mockReturnValue(makeRect(125, 60));
  content.append(visibleRow, focusedRow);
  document.body.append(content);
  content.scrollTop = 940;
  focusedRow.focus();

  expect(captureViewPosition(content, content)).toEqual({
    top: 940,
    anchor: { id: "holding/2454", offset: 45 },
    focusedAnchorId: "holding/2454",
  });
});

test("reports a clamped position until the saved offset can be reached", () => {
  const content = document.createElement("div");
  let maxScrollTop = 80;
  content.scrollTo = jest.fn(({ top }: { top?: number }) => {
    content.scrollTop = Math.min(top ?? 0, maxScrollTop);
  });

  expect(restoreViewPosition(content, content, { top: 350 })).toBe(false);
  expect(content.scrollTop).toBe(80);
  maxScrollTop = 1200;
  expect(restoreViewPosition(content, content, { top: 350 })).toBe(true);
  expect(content.scrollTop).toBe(350);
});
