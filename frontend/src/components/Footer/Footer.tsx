import React from "react";
import { NavLink } from "react-router-dom";

import { IRouter, withRouter } from "../../router";
import type { Subpage } from "../../types";
import Env from "../../utils/env";
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

  private readonly dashboardSubpages = [`${Env.frontendRootPath}handling-fee`];

  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        {this.props.subpages.map((subpage, idx) => {
          return this.isActive(subpage) ? (
            <div // prevent auto navigate one more time
              key={idx}
              className={`${styles.icon_outer} ${styles.active}`}
            >
              <div className={styles.icon_inner}>
                {subpage.icon_bold ?? subpage.icon}
              </div>
            </div>
          ) : (
            <NavLink
              to={subpage.path}
              key={idx}
              end={subpage.path === Env.frontendRootPath}
              className={styles.icon_outer}
            >
              <div className={styles.icon_inner}>{subpage.icon}</div>
            </NavLink>
          );
        })}
      </div>
    );
  }

  private isActive(subpage: Subpage): boolean {
    const currentPath = this.props.router.location.pathname;
    const pagePath = subpage.path;
    if (pagePath === Env.frontendRootPath) {
      if (currentPath === pagePath) {
        return true;
      } else if (this.dashboardSubpages.includes(currentPath)) {
        return true;
      } else {
        return false;
      }
    } else {
      return currentPath.startsWith(pagePath);
    }
  }
}

export default withRouter(Footer);
