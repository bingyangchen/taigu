import { useSyncExternalStore } from "react";
import { Outlet, useNavigation } from "react-router-dom";

import {
  addLoginCheckScreenListener,
  getLoginCheckScreenState,
  retryLoginCheck,
} from "../../utils/loginCheck";
import LoadingScreen from "./LoadingScreen";

function useLoginCheckScreenState() {
  return useSyncExternalStore(addLoginCheckScreenListener, getLoginCheckScreenState);
}

/** The loading screen shown while the login check of ACCT-R18 reads the account. */
export default function LoginCheckScreen() {
  const { status, isRetrying } = useLoginCheckScreenState();
  return (
    <LoadingScreen
      problem={
        status === "loading"
          ? undefined
          : { kind: status, isRetrying, onRetry: retryLoginCheck }
      }
    />
  );
}

/**
 * The root route's element. When the user moves from a page that needs no login to
 * one that does, it shows the login check's loading screen, which React Router would
 * otherwise leave out, keeping the old page on screen until the check ends (see
 * architecture.md). The page drawn on first load shows it as its `HydrateFallback`.
 */
export function LoginCheckLayout() {
  const navigation = useNavigation();
  const { isChecking } = useLoginCheckScreenState();
  return (
    <>
      <Outlet />
      {navigation.state === "loading" && isChecking && <LoginCheckScreen />}
    </>
  );
}
