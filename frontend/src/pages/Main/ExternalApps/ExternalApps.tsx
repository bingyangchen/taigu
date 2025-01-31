import simulator_icon from "../../../assets/simulator_icon.png";
import simulator_pro_icon from "../../../assets/simulator_pro_icon.png";
import styles from "./ExternalApps.module.scss";

import React from "react";

import { IconStar } from "../../../icons";
import { IRouter, withRouter } from "../../../router";

interface Props extends IRouter {}

interface State {}

class ExternalApps extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public componentDidMount(): void {}
    public componentWillUnmount(): void {}
    public render(): React.ReactNode {
        return (
            <div className={styles.main}>
                <h2 className={styles.title}>熱門輔助工具</h2>
                <div className={styles.app_list}>
                    <a
                        className={styles.app}
                        href="https://byc1999.com/stock-simulator/basic/"
                        target="_blank"
                        rel="noopener"
                    >
                        <div className={styles.number}>1</div>
                        <div className={styles.inner}>
                            <img src={simulator_icon} alt="" />
                            <div className={styles.right}>
                                <div className={styles.app_name}>
                                    投資策略模擬器
                                </div>
                                <div className={styles.star}>
                                    4.8
                                    <IconStar sideLength="10" />
                                </div>
                            </div>
                        </div>
                    </a>
                    <a
                        className={styles.app}
                        href="https://byc1999.com/stock-simulator/pro/"
                        target="_blank"
                        rel="noopener"
                    >
                        <div className={styles.number}>2</div>
                        <div className={styles.inner}>
                            <img src={simulator_pro_icon} alt="" />
                            <div className={styles.right}>
                                <div className={styles.app_name}>
                                    市場模擬器
                                </div>
                                <div className={styles.star}>
                                    4.5
                                    <IconStar sideLength="10" />
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        );
    }
}

export default withRouter(ExternalApps);
