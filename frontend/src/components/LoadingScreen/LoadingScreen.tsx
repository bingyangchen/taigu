import loadingSpinner from "../../assets/loading.svg";
import logo from "../../assets/logo.png";
import styles from "./LoadingScreen.module.scss";

import React from "react";

interface Props {}

interface State {}

export default class LoadingScreen extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <img className={styles.logo} src={logo} alt="" />
        <img className={styles.loading_spinner} src={loadingSpinner} alt="" />
      </div>
    );
  }
}
