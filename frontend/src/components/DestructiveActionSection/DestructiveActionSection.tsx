import React, { MouseEventHandler } from "react";

import { Button } from "../../components";
import styles from "./DestructiveActionSection.module.scss";

interface Props {
  buttonLabel: string;
  description: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
}

export default function DestructiveActionSection({
  buttonLabel,
  description,
  onClick,
}: Props): React.ReactElement {
  return (
    <section className={styles.main} aria-label="其他操作">
      <div className={styles.copy}>
        <div className={styles.title}>其他操作</div>
        <div className={styles.description}>{description}</div>
      </div>
      <Button className="dangerous l border" onClick={onClick}>
        {buttonLabel}
      </Button>
    </section>
  );
}
