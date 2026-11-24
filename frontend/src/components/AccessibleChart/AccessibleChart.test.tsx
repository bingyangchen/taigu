import { render, screen } from "@testing-library/react";

import AccessibleChart from "./AccessibleChart";

jest.mock("echarts-for-react", () => ({ __esModule: true, default: () => <canvas /> }));

test("names the chart with its unit and keeps it out of the tab order", () => {
  render(<AccessibleChart label="加權指數今日走勢（點）" option={{}} />);
  const chart = screen.getByRole("img", { name: "加權指數今日走勢（點）" });
  expect(chart).not.toHaveAttribute("tabindex");
});
