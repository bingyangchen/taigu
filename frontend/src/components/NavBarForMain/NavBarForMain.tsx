import styles from "./NavBarForMain.module.scss";

import React from "react";
import { connect } from "react-redux";
import { NavLink } from "react-router-dom";

import { FullLogo, LogoutButton, NavTab } from "..";
import { AppDispatch, RootState } from "../../redux/store";
import { settingsPagePath } from "../../router";
import { Subpage } from "../../types";
import Env from "../../utils/env";

function mapStateToProps(rootState: RootState) {
    const { isWaiting } = rootState.account;
    return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
    avatarUrl: string;
    username: string;
    subpages: Subpage[];
    isActiveInShortScreen: boolean;
    hide: () => void;
    dispatch: AppDispatch;
}

interface State {}

class NavBarForMain extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return (
            <>
                <div
                    className={`${styles.main} ${
                        this.props.isActiveInShortScreen ? styles.active : ""
                    }`}
                >
                    <NavLink
                        to={`${Env.frontendRootPath}${settingsPagePath}`}
                        onClick={this.props.hide}
                    >
                        <div className={styles.user_info}>
                            <img src={this.props.avatarUrl} alt="" />
                            <div className={styles.middle}>
                                <div className={styles.username}>
                                    {this.props.username}
                                </div>
                                <div className={styles.hint}>
                                    查看帳號與設定
                                </div>
                            </div>
                        </div>
                    </NavLink>
                    <div className={styles.subpage_list}>
                        {this.props.subpages.map((subpage, idx) => {
                            return (
                                <NavTab
                                    page={subpage}
                                    onClick={this.props.hide}
                                    key={idx}
                                    changeColor
                                    end={subpage.path === Env.frontendRootPath}
                                />
                            );
                        })}
                    </div>
                    <div className={styles.lower}>
                        <LogoutButton />
                        <div className={styles.logo_outer}>
                            <FullLogo size="s" />
                        </div>
                        <div className={styles.copyright}>
                            © TradeSmartly 2021-{new Date().getFullYear()}
                        </div>
                    </div>
                </div>
                <div
                    className={styles.small_screen_active_background}
                    onClick={this.props.hide}
                />
            </>
        );
    }
}

export default connect(mapStateToProps)(NavBarForMain);
