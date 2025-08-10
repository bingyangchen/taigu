import "./Button.scss";

import React, { EventHandler } from "react";

export interface Props {
  children: any;
  onClick?: EventHandler<any>;
  className: string;
  disabled?: boolean;
  waiting?: boolean;
  canTriggerByEnter?: boolean;
}

interface State {}

export default class Button extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public async componentDidMount(): Promise<void> {
    window.addEventListener("keypress", this.handleHitEnter);
  }
  public componentWillUnmount(): void {
    window.removeEventListener("keypress", this.handleHitEnter);
  }
  public render(): React.ReactNode {
    return (
      <button
        className={`button ${this.props.className} ${
          this.props.waiting ? "waiting" : ""
        }`}
        onClick={this.props.onClick || (() => {})}
        disabled={this.props.disabled || false}
      >
        {this.props.children}
      </button>
    );
  }
  private handleHitEnter = (e: KeyboardEvent): void => {
    if (this.props.canTriggerByEnter && e.key === "Enter") {
      this.props.onClick?.(e);
    }
  };
}
