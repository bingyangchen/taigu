import React from "react";
import { NavLink } from "react-router-dom";

import type { Subpage } from "../../types";
import Env from "../../utils/env";
import { getMainTabPath, mainTabNavigationState } from "../../utils/mainNavigation";
import { IRouter, withRouter } from "../../utils/router";
import styles from "./Footer.module.scss";

interface Props extends IRouter {
  subpages: Subpage[];
}

interface State {}

class Footer extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  private readonly dashboardSubpages = [
    `${Env.frontendRootPath}handling-fee`,
    `${Env.frontendRootPath}earning-analysis`,
    `${Env.frontendRootPath}market-index`,
  ];

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        {this.props.subpages.map((subpage, idx) => {
          const isHighlighted = this.isActive(subpage);
          return getMainTabPath(this.props.router.location) === subpage.path ? (
            <div // prevent auto navigate one more time
              key={idx}
              className={`${styles.icon_outer} ${styles.active}`}
              aria-current="page"
            >
              <div className={styles.icon_inner}>
                {subpage.icon_bold ?? subpage.icon}
              </div>
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

  private get currentPath(): string {
    return this.props.router.location.pathname;
  }

  private isActive(subpage: Subpage): boolean {
    const pagePath = subpage.path;
    if (pagePath === Env.frontendRootPath) {
      if (this.currentPath === pagePath) return true;
      return this.dashboardSubpages.includes(this.currentPath);
    }
    return this.currentPath === pagePath || this.currentPath.startsWith(`${pagePath}/`);
  }
}

export default withRouter(Footer);
