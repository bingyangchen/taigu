import React, { MouseEventHandler } from "react";
import { NavLink } from "react-router-dom";

import { IRouter, withRouter } from "../../router";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import { getMainTabPath, mainTabNavigationState } from "../../utils/mainNavigation";
import Tooltip from "../Tooltip/Tooltip";
import styles from "./NavTab.module.scss";

interface Props extends IRouter {
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

interface State {}

class NavTab extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  private readonly dashboardSubpages = [
    `${Env.frontendRootPath}handling-fee`,
    `${Env.frontendRootPath}earning-analysis`,
    `${Env.frontendRootPath}market-index/tse`,
    `${Env.frontendRootPath}market-index/otc`,
  ];

  public render(): React.ReactNode {
    const isCurrentTab = this.props.restoreTabPosition
      ? getMainTabPath(this.props.router.location) === this.props.page.path
      : this.isActive;
    const isHighlighted = this.props.changeColor && this.isActive;
    const tab =
      (this.props.isCustomActive === undefined && isCurrentTab) ||
      this.props.isCustomActive ? (
        <div // prevent auto navigate one more time
          className={`${styles.tab} ${this.props.changeColor ? styles.active : ""} ${this.props.iconOnly ? styles.icon_only : ""}`}
          aria-label={this.props.iconOnlyLabel}
        >
          <div className={styles.icon_outer}>{this.props.page.icon}</div>
          <span className={styles.label}>{this.props.page.name}</span>
        </div>
      ) : (
        <NavLink
          to={this.props.page.path}
          end={this.props.end ?? false}
          className={`${styles.tab} ${this.props.iconOnly ? styles.icon_only : ""} ${isHighlighted ? styles.active : ""}`}
          onClick={this.props.onClick}
          replace={this.props.replace ?? false}
          state={this.props.restoreTabPosition ? mainTabNavigationState : undefined}
          aria-label={this.props.iconOnlyLabel}
        >
          <div className={styles.icon_outer}>{this.props.page.icon}</div>
          <span className={styles.label}>{this.props.page.name}</span>
        </NavLink>
      );
    return this.props.iconOnly ? (
      <Tooltip content={this.props.page.name} side="right">
        {tab}
      </Tooltip>
    ) : (
      tab
    );
  }

  private get isActive(): boolean {
    const currentPath = this.props.router.location.pathname;
    const pagePath = this.props.page.path;
    if (pagePath === Env.frontendRootPath) {
      if (currentPath === pagePath) return true;
      return this.dashboardSubpages.includes(currentPath);
    }
    return currentPath === pagePath || currentPath.startsWith(`${pagePath}/`);
  }
}

export default withRouter(NavTab);
