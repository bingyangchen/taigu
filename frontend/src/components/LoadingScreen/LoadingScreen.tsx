import loadingSpinner from "../../assets/loading.svg";
import FullLogo from "../FullLogo/FullLogo";
import styles from "./LoadingScreen.module.scss";

export default function LoadingScreen() {
  return (
    <div className={styles.main}>
      <div className={styles.logo_wrapper}>
        <FullLogo size="m" />
      </div>
      <img className={styles.loading_spinner} src={loadingSpinner} alt="" />
    </div>
  );
}
