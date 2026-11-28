import { type LoaderFunctionArgs, replace } from "react-router-dom";

import { fetchAccountInfo } from "../redux/slices/AccountSlice";
import { store } from "../redux/store";
import { ACCOUNT_CACHE_ERROR_NAME } from "./accountCache";
import { CONNECTION_ERROR_NAME } from "./api";
import Env from "./env";
import { addNetworkStatusListener, isOnline } from "./network";
import { rememberReturnUrl } from "./returnUrl";

const ATTEMPT_TIMEOUT_MS = 10_000;
const AUTO_RESEND_DELAY_MS = 1000;

export type LoginCheckStatus = "loading" | "offline" | "unreachable";

export interface LoginCheckScreenState {
  status: LoginCheckStatus;
  isRetrying: boolean;
  isChecking: boolean;
}

type Outcome = "account" | "loggedOut";

/** ACCT-R18's 「嘗試」. */
interface Attempt {
  startedBy: "auto" | "retry";
  isActive: boolean;
}

interface Check {
  attempts: Attempt[];
  needsReload: boolean;
  finish: (outcome: Outcome) => void;
}

const INITIAL_SCREEN_STATE: LoginCheckScreenState = {
  status: "loading",
  isRetrying: false,
  isChecking: false,
};

let check: Check | null = null;
let screenState = INITIAL_SCREEN_STATE;
const screenListeners = new Set<() => void>();

/**
 * The loader of the layout route that holds every page needing login. The router
 * draws none of those pages until it ends, so a logged-out user never sees one
 * before the welcome page (ACCT-R3), and nobody sees one before the account is read
 * (ACCT-R18).
 */
export async function requireLogin({
  request,
}: LoaderFunctionArgs): Promise<Response | null> {
  const outcome = await checkLogin(request.signal);
  if (outcome === "account") return null;
  const { pathname, search } = new URL(request.url);
  rememberReturnUrl(pathname + search);

  // Replacing the entry keeps the browser's back button from reopening the page,
  // which would send the user to the welcome page again.
  return replace(`${Env.frontendRootPath}welcome`);
}

export function getLoginCheckScreenState(): LoginCheckScreenState {
  return screenState;
}

export function addLoginCheckScreenListener(listener: () => void): () => void {
  screenListeners.add(listener);
  return () => screenListeners.delete(listener);
}

/** The 「重試」 button of ACCT-R18. */
export function retryLoginCheck(): void {
  if (check === null || screenState.isRetrying) return;

  // The service worker never confirmed the account data isolation, and asking again
  // from this page would fail the same way (see architecture.md).
  if (check.needsReload) {
    window.location.reload();
    return;
  }
  runAttempt(check, "retry");
}

function checkLogin(signal: AbortSignal): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const unsubscribe = addNetworkStatusListener(() => {
      if (check !== newCheck) return;
      if (isOnline()) runAttempt(newCheck, "auto");
      else updateScreen();
    });
    const end = (): void => {
      unsubscribe();
      signal.removeEventListener("abort", abort);
      for (const attempt of newCheck.attempts) attempt.isActive = false;
      if (check === newCheck) check = null;

      // Left unannounced, so the screen stays until the router's next render replaces
      // it with the page; announcing it would show the old page for a moment.
      screenState = INITIAL_SCREEN_STATE;
    };
    const abort = (): void => {
      end();
      reject(signal.reason);
    };
    const newCheck: Check = {
      attempts: [],
      needsReload: false,
      finish: (outcome) => {
        end();
        resolve(outcome);
      },
    };
    check = newCheck;
    signal.addEventListener("abort", abort);
    if (isOnline()) runAttempt(newCheck, "auto");
    updateScreen();
  });
}

function runAttempt(target: Check, startedBy: Attempt["startedBy"]): void {
  const attempt: Attempt = { startedBy, isActive: true };
  target.attempts.push(attempt);
  const timer = window.setTimeout(() => endAttempt(), ATTEMPT_TIMEOUT_MS);
  const endAttempt = (): void => {
    window.clearTimeout(timer);
    if (!attempt.isActive) return;
    attempt.isActive = false;
    if (check === target) updateScreen();
  };
  const isLatest = (): boolean => target.attempts.at(-1) === attempt;
  updateScreen();

  const send = async (): Promise<void> => {
    let account;
    try {
      account = await store
        .dispatch(
          fetchAccountInfo({ redirectOnUnauthorized: false, silentOnFailure: true }),
        )
        .unwrap();
    } catch (error) {
      if (check !== target || !attempt.isActive) return;
      const errorName = getErrorName(error);
      if (errorName === CONNECTION_ERROR_NAME && startedBy === "auto") {
        await new Promise((wake) => window.setTimeout(wake, AUTO_RESEND_DELAY_MS));

        // A newer attempt takes over the resending, so a network that keeps dropping
        // does not stack one loop per attempt.
        if (check === target && attempt.isActive && isLatest()) await send();
        return;
      }
      if (errorName === ACCOUNT_CACHE_ERROR_NAME) target.needsReload = true;
      endAttempt();
      return;
    }

    // A request that outlives its attempt's 10 seconds still draws the page.
    if (check !== target) return;
    window.clearTimeout(timer);
    target.finish(account ? "account" : "loggedOut");
  };
  void send();
}

function updateScreen(): void {
  if (check === null) return;
  const latest = check.attempts.at(-1);
  let status: LoginCheckStatus;
  if (!isOnline()) status = "offline";
  else if (latest === undefined) status = "loading";
  else if (latest.isActive && latest.startedBy === "auto") status = "loading";
  else status = "unreachable";
  const isRetrying = check.attempts.some(
    (attempt) => attempt.isActive && attempt.startedBy === "retry",
  );
  if (
    status === screenState.status &&
    isRetrying === screenState.isRetrying &&
    screenState.isChecking
  ) {
    return;
  }
  screenState = { status, isRetrying, isChecking: true };
  for (const listener of screenListeners) listener();
}

// `unwrap()` rejects with the thunk's serialized error, which keeps only the error's
// `name`.
function getErrorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) return;
  return String(error.name);
}
