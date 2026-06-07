import "./index.scss";

import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";

import { store } from "./redux/store";
import reportWebVitals from "./reportWebVitals";
import myRouter from "./router";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

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

// Ref: https://cra.link/PWA
serviceWorkerRegistration.register();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
