const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "local.taigu.tw" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
    ),
);

type Config = {
  onSuccess?: (_registration: ServiceWorkerRegistration) => void;
  onUpdate?: (_registration: ServiceWorkerRegistration) => void;
};

export function register(config?: Config) {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // Installed PWAs update only from a worker at this URL.
      const swUrl = "/service-worker.js";

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.log("This web app is being served cache-first by a service worker.");
        });
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        let isUpdate = false;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === "installed") {
            isUpdate = Boolean(navigator.serviceWorker.controller);
            if (isUpdate) {
              console.log("New content is available; reloading to apply update.");
              config?.onUpdate?.(registration);
            } else {
              console.log("Content is cached for offline use.");
              config?.onSuccess?.(registration);
            }
          } else if (installingWorker.state === "activated" && isUpdate) {
            console.log("Reloading to update service worker...");

            // Don't use window.location.pathname = "/";
            // because this approach will push a new history.
            window.history.replaceState({}, "", "/");
            window.location.reload();
            console.log("Done.");
          }
        };
      };
    })
    .catch((error) => {
      console.error("Error during service worker registration:", error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
  fetch(swUrl, { headers: { "Service-Worker": "script" } })
    .then((response) => {
      const contentType = response.headers.get("content-type");
      if (response.status === 404 || contentType?.indexOf("javascript") === -1) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => console.log("No internet connection. Offline mode."));
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error.message));
  }
}
