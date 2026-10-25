import React from "react";

import loadingSpinner from "../../assets/loading.svg";
// Imported directly, not through ../../components, because router.tsx imports this
// component and the barrel imports components that import router.tsx.
import FullLogo from "../FullLogo/FullLogo";
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
        <div className={styles.logo_wrapper}>
          <FullLogo size="m" />
        </div>
        <img className={styles.loading_spinner} src={loadingSpinner} alt="" />
      </div>
    );
  }
}
