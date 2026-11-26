import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import LoadingScreen from "./LoadingScreen";

vi.mock("../FullLogo/FullLogo", () => ({ default: () => null }));

function getElapsed(container: HTMLElement): string {
  return (container.firstElementChild as HTMLElement).style.getPropertyValue(
    "--loading-screen-elapsed",
  );
}

test("continues the animation when it replaces another loading screen", () => {
  // The login check's loading screen hands over to the page's own, and replaying
  // the logo animation there would look like the page flashed.
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  const { container, rerender, unmount } = render(<LoadingScreen key="login-check" />);
  expect(getElapsed(container)).toBe("0ms");

  now.mockReturnValue(1600);
  rerender(<LoadingScreen key="page" />);

  expect(getElapsed(container)).toBe("600ms");
  unmount();
});

test("replays the animation once no loading screen is shown", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  const first = render(<LoadingScreen />);
  first.unmount();

  now.mockReturnValue(5000);
  const { container } = render(<LoadingScreen />);

  expect(getElapsed(container)).toBe("0ms");
});
