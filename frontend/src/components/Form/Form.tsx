import React from "react";

import { Button } from "../../components";
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
  return (
    <div className={styles.main}>
      <div className={styles.body}>{children}</div>
      <div className={styles.footer}>
        {secondaryFooterButton}
        {primaryFooterButton}
      </div>
    </div>
  );
}
