import React from "react";

import styles from "./BeautifulBlock.module.scss";

interface Props {
  title?: string;
  children: React.ReactNode;
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
        {this.props.title && <h2 className={styles.title}>{this.props.title}</h2>}
        <div className={styles.content}>{this.props.children}</div>
      </div>
    );
  }
}
