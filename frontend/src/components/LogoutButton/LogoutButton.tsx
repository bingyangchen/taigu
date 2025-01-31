import styles from "./LogoutButton.module.scss";

import React from "react";

import { connect } from "react-redux";
import { Modal } from "..";
import { logout } from "../../redux/slices/AccountSlice";
import { pushError } from "../../redux/slices/ErrorSlice";
import { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import Nav from "../../utils/nav";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
    const { isWaiting } = rootState.account;
    return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
    dispatch: AppDispatch;
}

interface State {
    activeModalName: "checkLogout" | null;
}

class LogoutButton extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = { activeModalName: null };
    }
    public render(): React.ReactNode {
        return (
            <>
                {this.state.activeModalName === "checkLogout" && (
                    <Modal
                        title="登出"
                        discardButtonProps={{
                            children: "取消",
                            className: "transparent l",
                            onClick: Util.getHideModalCallback(this),
                        }}
                        submitButtonProps={{
                            children: "登出",
                            className: "primary l",
                            disabled: this.props.isWaiting,
                            waiting: this.props.isWaiting,
                            onClick: this.handleClickCheckLogout,
                        }}
                        noX
                        silentBackground
                    >
                        您確定要登出嗎？
                    </Modal>
                )}
                <div
                    className={styles.main}
                    onClick={() => {
                        this.setState({ activeModalName: "checkLogout" });
                    }}
                >
                    登出
                </div>
            </>
        );
    }
    private handleClickCheckLogout = async (): Promise<void> => {
        try {
            await this.props.dispatch(logout()).unwrap();
            if (Nav.isAtLoginPage) return;

            this.props.router.navigate(`${Env.frontendRootPath}login`, {
                replace: true,
            });

            // Push one more state because Modal will do navigate(-1) after submitting.
            window.history.pushState({}, "", `${Env.frontendRootPath}login`);
        } catch (e: any) {
            this.props.dispatch(pushError({ message: e.message }));
        }
    };
}

export default connect(mapStateToProps)(withRouter(LogoutButton));
