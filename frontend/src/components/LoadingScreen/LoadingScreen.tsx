import {
  type CSSProperties,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import loadingSpinner from "../../assets/loading.svg";
import Button from "../Button/Button";
import FullLogo from "../FullLogo/FullLogo";
import styles from "./LoadingScreen.module.scss";

/** Why the login check of ACCT-R18 has not read the account. */
export interface LoadingScreenProblem {
  kind: "offline" | "unreachable";
  isRetrying: boolean;
  onRetry: () => void;
}

const problemKindToText: Record<
  LoadingScreenProblem["kind"],
  { title: string; detail: string }
> = {
  offline: { title: "沒有網路連線", detail: "連上網路後會自動繼續。" },
  unreachable: {
    title: "無法連上 Taigu",
    detail: "可能是網路不穩，或 Taigu 暫時無法使用。",
  },
};

// When one loading screen replaces another in the same render, such as a page's own
// after the login check, the new one continues the animation instead of replaying it.
let shownSince: number | null = null;
let mountedCount = 0;
const shownListeners = new Set<() => void>();

function addShownListener(listener: () => void): () => void {
  shownListeners.add(listener);
  return () => shownListeners.delete(listener);
}

/** Whether any loading screen covers the page. */
export function useIsLoadingScreenShown(): boolean {
  return useSyncExternalStore(
    addShownListener,
    () => mountedCount > 0,
    () => false,
  );
}

export default function LoadingScreen({ problem }: { problem?: LoadingScreenProblem }) {
  const [elapsedMs] = useState(() =>
    shownSince === null ? 0 : performance.now() - shownSince,
  );

  useLayoutEffect(() => {
    mountedCount += 1;
    shownSince ??= performance.now() - elapsedMs;
    if (mountedCount === 1) for (const listener of shownListeners) listener();
    return () => {
      mountedCount -= 1;
      if (mountedCount > 0) return;
      shownSince = null;
      for (const listener of shownListeners) listener();
    };
  }, [elapsedMs]);

  return (
    <div
      className={styles.main}
      style={{ "--loading-screen-elapsed": `${elapsedMs}ms` } as CSSProperties}
    >
      <div className={styles.logo_wrapper}>
        <FullLogo size="m" />
      </div>
      {problem ? (
        <div className={styles.problem}>
          <div
            className={styles.problem_text}
            role={problem.kind === "offline" ? "status" : "alert"}
          >
            <p className={styles.problem_title}>
              {problemKindToText[problem.kind].title}
            </p>
            <p className={styles.problem_detail}>
              {problemKindToText[problem.kind].detail}
            </p>
          </div>
          <Button
            variant="primary_fill"
            size="l"
            waiting={problem.isRetrying}
            onClick={problem.onRetry}
          >
            重試
          </Button>
        </div>
      ) : (
        <img className={styles.loading_spinner} src={loadingSpinner} alt="" />
      )}
    </div>
  );
}
