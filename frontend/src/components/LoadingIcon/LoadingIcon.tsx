import React from "react";

import loadingSpinner from "../../assets/loading.svg";
import styles from "./LoadingIcon.module.scss";

export default function LoadingIcon(): React.ReactElement {
  return <img className={styles.main} src={loadingSpinner} alt="" />;
}
