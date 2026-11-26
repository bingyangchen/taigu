import "./styles/base/index.scss";

import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";

import { removeStaticPageMeta } from "./components/PageMeta/PageMeta";
import { store } from "./redux/store";
import myRouter from "./router";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import Api from "./utils/api";
import { SESSION_VERSION_KEY } from "./utils/session";

Api.connectStore(store.dispatch);

window.addEventListener("storage", (event) => {
  if (event.key === SESSION_VERSION_KEY) {
    Api.clearAccountMemory();
    window.location.replace("/login");
  }
});

removeStaticPageMeta();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  // <React.StrictMode>
  <Provider store={store}>
    <RouterProvider router={myRouter} />
  </Provider>,
  // </React.StrictMode>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const navigator: Navigator & Record<"virtualKeyboard", any>;

if ("virtualKeyboard" in navigator) {
  navigator.virtualKeyboard.overlaysContent = true;
}

serviceWorkerRegistration.register();
