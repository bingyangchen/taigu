import styles from "./NavTab.module.scss";

import React, { MouseEventHandler } from "react";
import { NavLink } from "react-router-dom";

import { IRouter, withRouter } from "../../router";
import { Subpage } from "../../types";
import Env from "../../utils/env";

interface Props extends IRouter {
    page: Subpage;
    onClick: MouseEventHandler;
    changeColor?: boolean;
    replace?: boolean;
    end?: boolean;
    isCustomActive?: boolean;
}

interface State {}

class NavTab extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return (this.props.isCustomActive === undefined && this.isActive) ||
            this.props.isCustomActive ? (
            <div // prevent auto navigate one more time
                className={`${styles.tab} ${
                    this.props.changeColor ? styles.active : ""
                }`}
            >
                <div className={styles.icon_outer}>{this.props.page.icon}</div>
                {this.props.page.name}
            </div>
        ) : (
            <NavLink
                to={this.props.page.path}
                end={this.props.end || false}
                className={styles.tab}
                onClick={this.props.onClick}
                replace={this.props.replace || false}
            >
                <div className={styles.icon_outer}>{this.props.page.icon}</div>
                {this.props.page.name}
            </NavLink>
        );
    }
    private get isActive(): boolean {
        return (
            (this.props.router.location.pathname.indexOf(
                this.props.page.path
            ) === 0 &&
                this.props.page.path !== Env.frontendRootPath) ||
            (this.props.router.location.pathname === this.props.page.path &&
                this.props.page.path === Env.frontendRootPath)
        );
    }
}

export default withRouter(NavTab);
