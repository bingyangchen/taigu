import styles from "./BeautifulBlock.module.scss";

import React from "react";

interface Props {
    title?: string;
    description?: string;
    children: any;
}

interface State {}

export default class BeautifulBlock extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return (
            <div className={styles.main}>
                {this.props.title && (
                    <h2 className={styles.title}>{this.props.title}</h2>
                )}
                {this.props.description && (
                    <div className={styles.description}>
                        {this.props.description}
                    </div>
                )}
                {this.props.children}
            </div>
        );
    }
}
