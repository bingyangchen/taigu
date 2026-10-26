const SERVICE_WORKER_REPLY_TIMEOUT_MS = 2000;
const UPDATE_REQUIRED_MESSAGE = "無法完成操作，請重新整理後再試一次。";

export class AccountCacheError extends Error {
  public constructor() {
    super(UPDATE_REQUIRED_MESSAGE);
  }
}

let verifiedController: ServiceWorker | null = null;
let controllerCheck: { worker: ServiceWorker; request: Promise<void> } | null = null;

async function sendWorkerRequest(
  worker: ServiceWorker,
  type: string,
  expectedReply: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (accepted: boolean) => {
      window.clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (accepted) resolve();
      else reject(new AccountCacheError());
    };
    const timer = window.setTimeout(
      () => finish(false),
      SERVICE_WORKER_REPLY_TIMEOUT_MS,
    );
    channel.port1.onmessage = (event) => finish(event.data === expectedReply);
    channel.port1.onmessageerror = () => finish(false);
    try {
      worker.postMessage({ type }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

export async function ensureAccountCacheIsolation(): Promise<void> {
  const worker = navigator.serviceWorker?.controller;
  if (!worker || worker === verifiedController) return;
  if (controllerCheck?.worker !== worker) {
    const request = sendWorkerRequest(worker, "CHECK_ACCOUNT_CACHE", "isolated")
      .then(() => {
        verifiedController = worker;
      })
      .finally(() => {
        if (controllerCheck?.worker === worker) controllerCheck = null;
      });
    controllerCheck = { worker, request };
  }
  await controllerCheck.request;
}

export async function invalidateAccountCache(): Promise<void> {
  await ensureAccountCacheIsolation();
  const worker = navigator.serviceWorker?.controller;
  if (worker) await sendWorkerRequest(worker, "CLEAR_ACCOUNT_DATA", "cleared");
}
