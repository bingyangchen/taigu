import Nav from "./nav";

export default class Env {
  public static backendUrl: string = Nav.isLocalhost
    ? `https://${window.location.hostname}/api/`
    : "https://taigu.tw/api/";
  public static frontendRootPath: string = "/";
  public static cacheKey: string = "taigu";
  public static broadcastChannelName: string = "taigu";
}
