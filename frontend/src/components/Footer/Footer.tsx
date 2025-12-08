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
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        {this.props.subpages.map((subpage, idx) => {
          return (this.props.router.location.pathname.indexOf(subpage.path) === 0 &&
            subpage.path !== Env.frontendRootPath) ||
            (this.props.router.location.pathname === subpage.path &&
              subpage.path === Env.frontendRootPath) ? (
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
}

export default withRouter(Footer);
