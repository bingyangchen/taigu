import React, { KeyboardEvent } from "react";

import { IconChevronRight } from "../../icons";
import styles from "./SummaryCard.module.scss";

interface Props {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}

interface State {}

export default class SummaryCard extends React.Component<Props> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      <div
        className={`${styles.summary_card} ${this.isClickable ? styles.clickable : ""}`}
        onClick={this.props.onClick}
        role={this.isClickable ? "button" : undefined}
        tabIndex={this.isClickable ? 0 : undefined}
        onKeyDown={this.isClickable ? this.handleKeyDown : undefined}
      >
        <div className={styles.title}>{this.props.title}</div>
        <div className={styles.price}>{this.props.children}</div>
        {this.isClickable && (
          <div className={styles.chevron}>
            <IconChevronRight sideLength="12" />
          </div>
        )}
      </div>
    );
  }

  private get isClickable(): boolean {
    return !!this.props.onClick;
  }

  private handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.props.onClick?.();
    }
  };
}
