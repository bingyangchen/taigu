import styles from "./Overview.module.scss";

import React from "react";
import { connect } from "react-redux";

import {
    BeautifulBlock,
    BeautifulRow,
    FullLogo,
    NavBarForSettings,
} from "../../../components";
import { IconInfoCircle, IconPersonVcard } from "../../../icons";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import type { Subpage } from "../../../types";
import Env from "../../../utils/env";
import Util from "../../../utils/util";

function mapStateToProps(rootState: RootState) {
    const { email, username, avatar_url } = rootState.account;
    return { email, username, avatar_url };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
    dispatch: AppDispatch;
}
interface State {}

class Overview extends React.Component<Props, State> {
    public state: State;
    private subpages: Subpage[];
    public constructor(props: Props) {
        super(props);
        this.state = {};
        this.subpages = [
            {
                icon: <IconPersonVcard sideLength="100%" />,
                name: "基本資訊",
                path: "#basic-info",
            },
            // {
            //     icon: <IconCreditCard sideLength="100%" />,
            //     name: "付款與方案",
            //     path: "#billing-and-plans",
            // },
            // {
            //     icon: <IconBell sideLength="100%" />,
            //     name: "通知",
            //     path: "#notification",
            // },
            {
                icon: <IconInfoCircle sideLength="100%" />,
                name: "關於 TradeSmartly",
                path: "#about",
            },
        ];
    }
    public componentDidMount(): void {
        this.props.dispatch(updateHeaderTitle(""));
    }
    public render(): React.ReactNode {
        return (
            <div className={styles.main}>
                {!Util.isMobile && (
                    <NavBarForSettings subpages={this.subpages} />
                )}
                <div className={styles.body}>
                    <div id="basic-info" className={styles.section}>
                        <BeautifulBlock title="基本資訊">
                            <BeautifulRow
                                label="頭像"
                                onClick={() =>
                                    this.props.router.navigate(
                                        `${Env.frontendRootPath}${settingsPagePath}/avatar`
                                    )
                                }
                            >
                                {this.props.avatar_url && (
                                    <div className={styles.avatar_container}>
                                        <img
                                            className={styles.avatar}
                                            src={this.props.avatar_url}
                                            alt=""
                                        />
                                    </div>
                                )}
                            </BeautifulRow>
                            <BeautifulRow
                                label="名稱"
                                onClick={() =>
                                    this.props.router.navigate(
                                        `${Env.frontendRootPath}${settingsPagePath}/username`
                                    )
                                }
                            >
                                {this.props.username}
                            </BeautifulRow>
                            <BeautifulRow label="Email">
                                {this.props.email}
                            </BeautifulRow>
                        </BeautifulBlock>
                    </div>
                    {/* <div id="billing-and-plans" className={styles.section}>
                        <BeautifulBlock title="付款與方案">
                            <BeautifulRow
                                label="目前方案"
                                onClick={() =>
                                    this.props.router.navigate(
                                        `${Env.frontendRootPath}${settingsPagePath}/current-plan`
                                    )
                                }
                            >
                                Premium
                            </BeautifulRow>
                            <BeautifulRow
                                label="付款資訊"
                                onClick={() =>
                                    this.props.router.navigate(
                                        `${Env.frontendRootPath}${settingsPagePath}/payment-information`
                                    )
                                }
                            >
                                無
                            </BeautifulRow>
                        </BeautifulBlock>
                    </div> */}
                    {/* <div id="notification" className={styles.section}>
                        <BeautifulBlock title="通知">
                            <BeautifulRow
                                label="交易通知"
                                onClick={() =>
                                    this.props.router.navigate(
                                        `${Env.frontendRootPath}${settingsPagePath}/notification`
                                    )
                                }
                            >
                                當商品價格觸及你的目標價格時，發送通知給你
                            </BeautifulRow>
                        </BeautifulBlock>
                    </div> */}
                    <div id="about" className={styles.section}>
                        <BeautifulBlock title="關於 TradeSmartly">
                            <BeautifulRow>
                                <FullLogo size="m" />
                            </BeautifulRow>
                            <BeautifulRow
                                label="隱私權政策"
                                onClick={() =>
                                    window.open(
                                        `${Env.frontendRootPath}privacy-policy`,
                                        "_blank"
                                    )
                                }
                            />
                            <BeautifulRow
                                label="服務條款"
                                onClick={() =>
                                    window.open(
                                        `${Env.frontendRootPath}terms-of-service`,
                                        "_blank"
                                    )
                                }
                            />
                            <BeautifulRow>
                                <div className={styles.copyright}>
                                    Copyright {new Date().getFullYear()}{" "}
                                    TradeSmartly All rights reserved.
                                </div>
                            </BeautifulRow>
                        </BeautifulBlock>
                    </div>
                    {/* <div className={styles.section}>
                        <BeautifulBlock title="刪除帳號">
                            <BeautifulRow>
                                <Button
                                    className="dangerous border p8-15"
                                    onClick={() =>
                                        this.props.router.navigate(
                                            `${Env.frontendRootPath}${settingsPagePath}/delete-account`
                                        )
                                    }
                                >
                                    永久刪除帳號
                                </Button>
                            </BeautifulRow>
                        </BeautifulBlock>
                    </div> */}
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(withRouter(Overview));
