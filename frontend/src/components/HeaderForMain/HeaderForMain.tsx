import styles from "./HeaderForMain.module.scss";

import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import { FullLogo, RoundButton } from "..";
import type { RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import Nav from "../../utils/nav";

function mapStateToProps(rootState: RootState) {
    const { scrollTop } = rootState.mainPage;
    return { mainScrollTop: scrollTop };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
    avatarUrl: string;
    handleClickAvatar: MouseEventHandler;
}

interface State {}

class HeaderForMain extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return (
            <header className={styles.main}>
                <div className={styles.main_inner}>
                    <FullLogo
                        size="s"
                        textOpacity={this.logoTextOpacity}
                        translateX={this.logoTranslateX}
                    />
                    <RoundButton onClick={this.props.handleClickAvatar}>
                        <img
                            src={this.props.avatarUrl}
                            alt=""
                            className={styles.user_avatar}
                        />
                    </RoundButton>
                </div>
            </header>
        );
    }
    private get logoTextOpacity(): number {
        if (Nav.isAtStockListPage || Nav.isAtDetailsPage) {
            return Math.max(0, 45 - this.props.mainScrollTop) / 45;
        }
        return 1;
    }
    private get logoTranslateX(): number {
        if (Nav.isAtDetailsPage) {
            return 40;
        }
        return 0;
    }
}

export default connect(mapStateToProps)(withRouter(HeaderForMain));
