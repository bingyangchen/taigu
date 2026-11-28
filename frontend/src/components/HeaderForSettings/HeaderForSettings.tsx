import { memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { RoundButton } from "../../components";
import * as Icons from "../../icons";
import { useAppSelector } from "../../redux/hooks";
import Env from "../../utils/env";
import { returnToSettings, settingsPagePath } from "../../utils/router";
import styles from "./HeaderForSettings.module.scss";

function HeaderForSettings() {
  const headerTitle = useAppSelector((state) => state.settingsPage.headerTitle);
  const location = useLocation();
  const navigate = useNavigate();

  const goToParentDirectory = (): void => {
    let currentPath = location.pathname;
    if (currentPath[currentPath.length - 1] === "/") {
      currentPath = currentPath.slice(0, -1);
    }
    const parentDirectory = currentPath.substring(0, currentPath.lastIndexOf("/"));
    if (parentDirectory === `${Env.frontendRootPath}${settingsPagePath}`) {
      returnToSettings({ location, navigate });
      return;
    }
    navigate(parentDirectory || Env.frontendRootPath, { replace: true });
  };

  return (
    <header className={styles.main}>
      <RoundButton size="l" hint_text="上一頁" onClick={goToParentDirectory}>
        <Icons.IconChevronLeft sideLength="16" />
      </RoundButton>
      {headerTitle}
    </header>
  );
}

export default memo(HeaderForSettings);
