export const closeActiveModalEventName = "taigu:close-active-modal";

type CloseActiveModalDetail = {
  handled: boolean;
  popHistory: boolean;
  done: () => void;
};

export type CloseActiveModalEvent = CustomEvent<CloseActiveModalDetail>;

export async function requestCloseActiveModal({
  popHistory = true,
}: { popHistory?: boolean } = {}): Promise<void> {
  let resolveClose: () => void = () => {};
  const closePromise = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  const event: CloseActiveModalEvent = new CustomEvent(closeActiveModalEventName, {
    detail: { handled: false, popHistory, done: resolveClose },
  });
  window.dispatchEvent(event);
  if (!event.detail.handled) {
    resolveClose();
  }
  await closePromise;
  await waitForNextFrame();
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
