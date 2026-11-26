import React from "react";

import styles from "./BeautifulBlock.module.scss";

interface Props {
  id?: string;
  title?: string;
  children: React.ReactNode;
}

export default function BeautifulBlock({ id, title, children }: Props) {
  return (
    <div className={styles.main} id={id ?? undefined}>
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
