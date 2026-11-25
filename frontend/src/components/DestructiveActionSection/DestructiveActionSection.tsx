import React, { MouseEventHandler } from "react";

import { Button } from "../../components";
import styles from "./DestructiveActionSection.module.scss";

interface Props {
  buttonLabel: string;
  description: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

export default function DestructiveActionSection({
  buttonLabel,
  description,
  onClick,
  className = "",
}: Props): React.ReactElement {
  return (
    <section className={`${styles.main} ${className}`} aria-label="其他操作">
      <div className={styles.copy}>
        <div className={styles.title}>其他操作</div>
        <div className={styles.description}>{description}</div>
      </div>
      <Button type="button" className="dangerous l border" onClick={onClick}>
        {buttonLabel}
      </Button>
    </section>
  );
}
