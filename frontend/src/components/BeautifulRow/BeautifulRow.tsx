import styles from "./BeautifulRow.module.scss";

import React, { MouseEventHandler } from "react";

import { IconChevronRight } from "../../icons";

interface Props {
    label?: string;
    children?: any;
    onClick?: MouseEventHandler;
}

interface State {}

export default class BeautifulRow extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return (
            <div
                className={this.mainClassName}
                onClick={this.props.onClick || (() => {})}
            >
                {this.props.label && (
                    <div className={styles.label}>{this.props.label}</div>
                )}
                <div className={styles.value}>
                    {typeof this.props.children === "string"
                        ? this.string2jsx(this.props.children)
                        : this.props.children}
                </div>
                {this.props.onClick && (
                    <div className={styles.tail_mark}>
                        <IconChevronRight sideLength="13" />
                    </div>
                )}
            </div>
        );
    }
    private get mainClassName(): string {
        return `${styles.main} ${this.props.onClick ? styles.reactive : ""}`;
    }
    private string2jsx(s: string): React.ReactNode {
        const stringList: string[] = s.split("\n");
        return stringList.map((each, idx) => {
            return (
                <React.Fragment key={idx}>
                    <div className={styles.s}>{each || " "}</div>
                </React.Fragment>
            );
        });
    }
}
