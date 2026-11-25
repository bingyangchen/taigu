function isLocalhost(): boolean {
  const { hostname } = window.location;
  return Boolean(
    (hostname === "localhost" ||
      hostname === "local.taigu.tw" ||
      hostname.endsWith(".localhost") ||
      // [::1] is the IPv6 localhost address.
      hostname === "[::1]" ||
      // 127.0.0.0/8 are considered localhost for IPv4.
      hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)) ??
      // 192.168.0.0/16 are considered localhost for IPv4.
      hostname.match(/^192\.168(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){2}$/),
  );
}

export default class Env {
  // A getter, so the prerender can import this module in Node, where `window` does
  // not exist.
  public static get backendUrl(): string {
    return isLocalhost()
      ? `https://${window.location.hostname}/api/`
      : "https://api.taigu.tw/api/";
  }
  public static frontendRootPath: string = "/";
  // Canonical/OG URLs must always point at the production origin, even when
  // the app runs on localhost or in the build-time prerenderer.
  public static siteOrigin: string = "https://taigu.tw";
}
