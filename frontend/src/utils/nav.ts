import Env from "./env";
import { rememberReturnUrl } from "./returnUrl";

export default class Nav {
  public static get isAt404Page(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}404[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static goTo404Page(): void {
    if (Nav.isAt404Page) return;

    // Don't use window.location.pathname = `${Env.frontendRootPath}404`;
    // because this approach will push a new history.
    window.history.replaceState({}, "", `${Env.frontendRootPath}404`);
    window.location.reload();
  }
  public static get isAtMarketPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}market[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtMarketIndexDetailsPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}market-index[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtDetailsPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}market/(.*)[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtEarningAnalysisPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}earning-analysis[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtHandlingFeePage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}handling-fee[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtSettingsOverviewPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}settings[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtLoginPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}login[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static get isAtWelcomePage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}welcome[/]?$`;
    const escapedRegex = new RegExp(pathRegexString, "gs");
    return escapedRegex.test(window.location.pathname);
  }
  public static clearSearchParams(): void {
    const currentUrl = new URL(window.location.href);
    currentUrl.search = "";
    window.history.replaceState(window.history.state, "", currentUrl.href);
  }
  public static goToWelcomePage(from?: string): void {
    if (Nav.isAtWelcomePage) return;
    if (from) rememberReturnUrl(from);

    // Don't use window.location.pathname = `${Env.frontendRootPath}welcome`;
    // because this approach will push a new history.
    window.history.replaceState({}, "", `${Env.frontendRootPath}welcome`);
    window.location.reload();
  }
}
