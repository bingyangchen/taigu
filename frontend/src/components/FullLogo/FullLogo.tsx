import React from "react";

import logo from "../../assets/logo-no-bg.png";
import styles from "./FullLogo.module.scss";

interface Props {
  size: "s" | "m" | "l";
  translateX?: number;
}

interface State {}

export default class FullLogo extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      <div
        className={this.class_name}
        style={{ transform: `translateX(${this.props.translateX ?? 0}px)` }}
      >
        <img className={styles.logo} src={logo} alt="" />
      </div>
    );
  }
  private get class_name(): string {
    return (
      styles.main +
      " " +
      (this.props.size === "s"
        ? styles.s
        : this.props.size === "m"
          ? styles.m
          : styles.l)
    );
  }
}
