import { NavLink, useLocation } from "react-router-dom";

import type { Subpage } from "../../types";
import Env from "../../utils/env";
import {
  getMainTabPath,
  isMainTabActive,
  mainTabNavigationState,
} from "../../utils/mainNavigation";
import styles from "./Footer.module.scss";

interface Props {
  subpages: Subpage[];
}

export default function Footer({ subpages }: Props) {
  const location = useLocation();
  return (
    <div className={styles.main}>
      {subpages.map((subpage, idx) => {
        const isHighlighted = isMainTabActive(location.pathname, subpage.path);
        return getMainTabPath(location) === subpage.path ? (
          <div // prevent auto navigate one more time
            key={idx}
            className={`${styles.icon_outer} ${styles.active}`}
            aria-current="page"
          >
            <div className={styles.icon_inner}>{subpage.icon_bold ?? subpage.icon}</div>
            <div className={styles.label}>{subpage.name}</div>
          </div>
        ) : (
          <NavLink
            to={subpage.path}
            key={idx}
            end={subpage.path === Env.frontendRootPath}
            className={`${styles.icon_outer} ${isHighlighted ? styles.active : ""}`}
            state={mainTabNavigationState}
          >
            <div className={styles.icon_inner}>
              {isHighlighted ? (subpage.icon_bold ?? subpage.icon) : subpage.icon}
            </div>
            <div className={styles.label}>{subpage.name}</div>
          </NavLink>
        );
      })}
    </div>
  );
}
