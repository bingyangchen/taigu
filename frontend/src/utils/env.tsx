import Nav from "./nav";

export default class Env {
    public static backendUrl: string = Nav.isLocalhost
        ? `https://${window.location.hostname}:8000/api/`
        : "https://trade-smartly.com/api/";
    public static frontendRootPath: string = "/";
    public static cacheKey: string = "trade-smartly";
    public static broadcastChannelName: string = "trade-smartly";
}
