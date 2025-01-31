import Env from "./env";
import Nav from "./nav";

export default class Api {
    public static async sendRequest(
        endpoint: string,
        method: string,
        requestBody?: URLSearchParams | string
    ): Promise<any> {
        if (method === "post" && requestBody === undefined) {
            throw Error("requestBody is needed in POST request");
        }

        const header = new Headers();
        header.append("Accept", "application/json");

        if (typeof requestBody === "string") {
            header.append("Content-Type", "application/json");
        }

        const options: RequestInit = {
            method: method,
            headers: header,
            body: requestBody,
            credentials: "include",
        };

        return await fetch(`${Env.backendUrl}${endpoint}`, options).then(
            Api.handleResponse
        );
    }
    private static async handleResponse(r: Response): Promise<any> {
        if (r.status === 404) Nav.goTo404Page();
        else if (r.status === 401) {
            caches.delete(Env.cacheKey);
            if (!Nav.isAtLoginPage) {
                Nav.goToWelcomePage(
                    window.location.pathname + window.location.search
                );
            }
        } else return r.json();
    }
}
