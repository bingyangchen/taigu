import React from "react";

import { Button } from "../../components";
import { useOfflineNoticeObstacle } from "../OfflineNotice/obstacles";
import styles from "./Form.module.scss";

interface Props {
  children: React.ReactNode;
  primaryFooterButton?: React.ReactElement<React.ComponentProps<typeof Button>>;
  secondaryFooterButton?: React.ReactElement<React.ComponentProps<typeof Button>>;
}

export default function Form({
  children,
  primaryFooterButton,
  secondaryFooterButton,
}: Props) {
  const offlineNoticeObstacleRef = useOfflineNoticeObstacle();
  return (
    <div className={styles.main}>
      <div className={styles.body}>{children}</div>
      <div className={styles.footer} ref={offlineNoticeObstacleRef}>
        {secondaryFooterButton}
        {primaryFooterButton}
      </div>
    </div>
  );
}
