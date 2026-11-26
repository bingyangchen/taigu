import React, { MouseEventHandler } from "react";

import Tooltip from "../Tooltip/Tooltip";
import styles from "./RoundButton.module.scss";

interface Props {
  children: React.ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  size?: "m" | "l";
  frosted?: boolean;
  disabled?: boolean;
  hint_text?: string;
  "aria-label"?: string;
}

interface State {}

export default class RoundButton extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    const button = (
      <button
        type="button"
        aria-label={this.props["aria-label"] ?? this.props.hint_text}
        className={[
          styles.main,
          this.props.size === "l" && styles.l,
          this.props.frosted && styles.frosted,
          this.props.disabled && styles.disabled,
          this.props.className,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={this.props.disabled ? () => {} : (this.props.onClick ?? (() => {}))}
        disabled={this.props.disabled}
      >
        {this.props.children}
      </button>
    );

    if (!this.props.hint_text) return button;
    return <Tooltip content={this.props.hint_text}>{button}</Tooltip>;
  }
}
