import logo from "../../assets/logo.png";
import styles from "./FullLogo.module.scss";

import React from "react";

interface Props {
  size: "s" | "m" | "l";
  textOpacity?: number;
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
        style={{
          transform: `translateX(${this.props.translateX || 0}px)`,
        }}
      >
        <div className={styles.logo_container}>
          <img className={styles.logo} src={logo} alt="" />
        </div>
        <div
          className={styles.product_name}
          style={{ opacity: this.props.textOpacity ?? 1 }}
        >
          Taigu
        </div>
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
