import styles from "./PercentSign.module.scss";

import React from "react";

interface Props {}

interface State {}

export default class PercentSign extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public render(): React.ReactNode {
        return <span className={styles.main} />;
    }
}
