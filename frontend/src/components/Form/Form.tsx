import React, { MouseEventHandler } from "react";

import { Button, RoundButton } from "../../components";
import { IconChevronLeft } from "../../icons";
import Util from "../../utils/util";
import styles from "./Form.module.scss";

interface Props {
  title: string;
  goBackHandler: MouseEventHandler;
  children: any;
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
        {!Util.isMobile && (
          <div className={styles.header}>
            <RoundButton
              className="p-12"
              onClick={this.props.goBackHandler}
              hint_text="上一頁"
            >
              <IconChevronLeft sideLength="16" />
            </RoundButton>
            <h1>{this.props.title}</h1>
          </div>
        )}
        <div className={styles.body}>{this.props.children}</div>
        <div className={styles.footer}>
          {this.props.secondaryFooterButton}
          {this.props.primaryFooterButton}
        </div>
      </div>
    );
  }
}
