import styles from "./FormForSigning.module.scss";

import React from "react";

import { Button, FullLogo } from "..";
import Util from "../../utils/util";

interface Props {
    children: any;
    primaryFooterButton?: React.ReactElement<Button>;
    secondaryFooterButton?: React.ReactElement<Button>;
}

interface State {}

export default class FormForSigning extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return (
            <div
                className={`${styles.main} ${
                    Util.isMobile ? styles.mobile : ""
                }`}
            >
                <div className={styles.header}>
                    <FullLogo size="l" />
                </div>
                <div className={styles.body}>{this.props.children}</div>
                <div className={styles.footer}>
                    {this.props.secondaryFooterButton}
                    {this.props.primaryFooterButton}
                </div>
            </div>
        );
    }
}
