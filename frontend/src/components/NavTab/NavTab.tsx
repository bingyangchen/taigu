import { MouseEventHandler } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Subpage } from "../../types";
import {
  getMainTabPath,
  isMainTabActive,
  mainTabNavigationState,
} from "../../utils/mainNavigation";
import Tooltip from "../Tooltip/Tooltip";
import styles from "./NavTab.module.scss";

interface Props {
  page: Subpage;
  onClick?: MouseEventHandler;
  changeColor?: boolean;
  replace?: boolean;
  end?: boolean;
  isCustomActive?: boolean;
  iconOnlyLabel?: string;
  iconOnly?: boolean;
  restoreTabPosition?: boolean;
}

export default function NavTab({
  page,
  onClick,
  changeColor,
  replace,
  end,
  isCustomActive,
  iconOnlyLabel,
  iconOnly,
  restoreTabPosition,
}: Props) {
  const location = useLocation();
  const isActive = isMainTabActive(location.pathname, page.path);
  const isCurrentTab = restoreTabPosition
    ? getMainTabPath(location) === page.path
    : isActive;
  const isHighlighted = changeColor && isActive;
  const tab =
    (isCustomActive === undefined && isCurrentTab) || isCustomActive ? (
      <div // prevent auto navigate one more time
        className={`${styles.tab} ${changeColor ? styles.active : ""} ${iconOnly ? styles.icon_only : ""}`}
        aria-label={iconOnlyLabel}
      >
        <div className={styles.icon_outer}>{page.icon}</div>
        <span className={styles.label}>{page.name}</span>
      </div>
    ) : (
      <NavLink
        to={page.path}
        end={end ?? false}
        className={`${styles.tab} ${iconOnly ? styles.icon_only : ""} ${isHighlighted ? styles.active : ""}`}
        onClick={onClick}
        replace={replace ?? false}
        state={restoreTabPosition ? mainTabNavigationState : undefined}
        aria-label={iconOnlyLabel}
      >
        <div className={styles.icon_outer}>{page.icon}</div>
        <span className={styles.label}>{page.name}</span>
      </NavLink>
    );
  return iconOnly ? (
    <Tooltip content={page.name} side="right">
      {tab}
    </Tooltip>
  ) : (
    tab
  );
}
