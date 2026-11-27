import companyInfo from "../../assets/welcome/company-info.webp";
import dashboard from "../../assets/welcome/dashboard.webp";
import dividends from "../../assets/welcome/dividends.webp";
import handlingFee from "../../assets/welcome/handling-fee.webp";
import holdings from "../../assets/welcome/holdings.webp";
import marketIndex from "../../assets/welcome/market-index.webp";
import records from "../../assets/welcome/records.webp";
import stockDetails from "../../assets/welcome/stock-details.webp";
import stockMemo from "../../assets/welcome/stock-memo.webp";
import tradePlans from "../../assets/welcome/trade-plans.webp";

// Every phone screenshot is the app's narrow layout at 390×763 CSS px, captured at 2×
// from a demo account whose data is fictional.
export const SCREENSHOT_WIDTH = 780;
export const SCREENSHOT_HEIGHT = 1526;

export interface PhoneScreen {
  src: string;

  // The colors of the screenshot's top and bottom rows. The phone frame extends them
  // into the status bar and the home indicator band, so each band continues the
  // screenshot's own background: the app's gradient shell, or a sheet's dimmed
  // backdrop. They are sampled from the images, so they are not design tokens.
  topColor: string;
  bottomColor: string;
}

const GRADIENT_TOP = "#d1eeff";
const PAGE_TOP = "#f6f9fc";

export const SCREENS = {
  companyInfo: { src: companyInfo, topColor: "#87898a", bottomColor: "#ffffff" },
  dashboard: { src: dashboard, topColor: GRADIENT_TOP, bottomColor: "#f5f8ff" },
  dividends: { src: dividends, topColor: GRADIENT_TOP, bottomColor: "#fff7ff" },
  handlingFee: { src: handlingFee, topColor: GRADIENT_TOP, bottomColor: "#fdfcff" },
  holdings: { src: holdings, topColor: PAGE_TOP, bottomColor: "#fbf6f7" },
  marketIndex: { src: marketIndex, topColor: PAGE_TOP, bottomColor: "#fbfdff" },
  records: { src: records, topColor: PAGE_TOP, bottomColor: "#fbfdff" },
  stockDetails: { src: stockDetails, topColor: PAGE_TOP, bottomColor: "#fbfdfe" },
  stockMemo: { src: stockMemo, topColor: "#87898a", bottomColor: "#ffffff" },
  tradePlans: { src: tradePlans, topColor: PAGE_TOP, bottomColor: "#fbfdff" },
} satisfies Record<string, PhoneScreen>;
