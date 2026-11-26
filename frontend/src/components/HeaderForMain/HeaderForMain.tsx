import { memo } from "react";
import { useLocation } from "react-router-dom";

import { FullLogo } from "../../components";
import { useAppSelector } from "../../redux/hooks";
import Nav from "../../utils/nav";
import styles from "./HeaderForMain.module.scss";

function HeaderForMain() {
  const headerTitle = useAppSelector((state) => state.mainPage.headerTitle);

  // Nav reads window.location, so subscribing to the location re-renders the header
  // after each navigation.
  useLocation();

  const logoTranslateX =
    Nav.isAtDetailsPage || Nav.isAtHandlingFeePage || Nav.isAtEarningAnalysisPage
      ? 40
      : 0;

  return (
    <header className={styles.main}>
      {headerTitle ? (
        <div className={styles.title}>{headerTitle}</div>
      ) : (
        <FullLogo size="s" translateX={logoTranslateX} />
      )}
    </header>
  );
}

export default memo(HeaderForMain);
