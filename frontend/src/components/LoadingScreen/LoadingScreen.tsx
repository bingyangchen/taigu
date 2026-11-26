import { type CSSProperties, useLayoutEffect, useState } from "react";

import loadingSpinner from "../../assets/loading.svg";
import FullLogo from "../FullLogo/FullLogo";
import styles from "./LoadingScreen.module.scss";

// When one loading screen replaces another in the same render, such as a page's own
// after the login check, the new one continues the animation instead of replaying it.
let shownSince: number | null = null;
let mountedCount = 0;

export default function LoadingScreen() {
  const [elapsedMs] = useState(() =>
    shownSince === null ? 0 : performance.now() - shownSince,
  );

  useLayoutEffect(() => {
    mountedCount += 1;
    shownSince ??= performance.now() - elapsedMs;
    return () => {
      mountedCount -= 1;
      if (mountedCount === 0) shownSince = null;
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
      <img className={styles.loading_spinner} src={loadingSpinner} alt="" />
    </div>
  );
}
