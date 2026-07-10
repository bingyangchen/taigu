import Nav from "./nav";

export default class Env {
  public static backendUrl: string = Nav.isLocalhost
    ? `https://${window.location.hostname}/api/`
    : "https://api.taigu.tw/api/";
  public static frontendRootPath: string = "/";
  // Canonical/OG URLs must always point at the production origin, even when
  // the app runs on localhost or in the build-time prerenderer.
  public static siteOrigin: string = "https://taigu.tw";
  public static cacheKey: string = "taigu";
  public static broadcastChannelName: string = "taigu";
}
