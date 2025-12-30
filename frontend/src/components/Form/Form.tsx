import React from "react";

import { Button } from "../../components";
import styles from "./Form.module.scss";

interface Props {
  children: React.ReactNode;
  primaryFooterButton?: React.ReactElement<Button>;
  secondaryFooterButton?: React.ReactElement<Button>;
}

interface State {}

export default class Form extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.body}>{this.props.children}</div>
        <div className={styles.footer}>
          {this.props.secondaryFooterButton}
          {this.props.primaryFooterButton}
        </div>
      </div>
    );
  }
}
