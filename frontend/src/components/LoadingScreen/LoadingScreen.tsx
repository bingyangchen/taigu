import React from "react";

import loadingSpinner from "../../assets/loading.svg";
import { FullLogo } from "../../components";
import styles from "./LoadingScreen.module.scss";

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
        <FullLogo size="l" />
        <img className={styles.loading_spinner} src={loadingSpinner} alt="" />
      </div>
    );
  }
}
