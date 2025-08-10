import Env from "./env";

export default class Nav {
  public static isLocalhost = Boolean(
    window.location.hostname === "localhost" ||
      window.location.hostname.endsWith(".localhost") ||
      // [::1] is the IPv6 localhost address.
      window.location.hostname === "[::1]" ||
      // 127.0.0.0/8 are considered localhost for IPv4.
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
      ) ||
      // 192.168.0.0/16 are considered localhost for IPv4.
      window.location.hostname.match(
        /^192\.168(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){2}$/,
      ),
  );
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
  public static get isAtDetailsPage(): boolean {
    const pathRegexString = `^${Env.frontendRootPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}market/(.*)[/]?$`;
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
  public static goToWelcomePage(from?: string): void {
    if (Nav.isAtWelcomePage) return;
    if (from) window.localStorage.setItem("pathAndQueryString", from);

    // Don't use window.location.pathname = `${Env.frontendRootPath}welcome`;
    // because this approach will push a new history.
    window.history.replaceState({}, "", `${Env.frontendRootPath}welcome`);
    window.location.reload();
  }
}
