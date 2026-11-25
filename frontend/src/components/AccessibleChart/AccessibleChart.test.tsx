import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import AccessibleChart from "./AccessibleChart";

vi.mock("echarts-for-react", () => ({ default: () => <canvas /> }));

test("names the chart with its unit and keeps it out of the tab order", () => {
  render(<AccessibleChart label="加權指數今日走勢（點）" option={{}} />);
  const chart = screen.getByRole("img", { name: "加權指數今日走勢（點）" });
  expect(chart).not.toHaveAttribute("tabindex");
});
