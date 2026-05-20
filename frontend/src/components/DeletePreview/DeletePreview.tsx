import React, { ReactNode } from "react";

import styles from "./DeletePreview.module.scss";

type DetailTone = "neutral" | "buy" | "sell";

type Detail = { label: string; value: ReactNode; tone?: DetailTone };

interface Props {
  title: string;
  meta?: string;
  details: Detail[];
}

export default function DeletePreview({
  details,
  meta,
  title,
}: Props): React.ReactElement {
  return (
    <div className={styles.main} aria-label="即將刪除的資料">
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
      <div className={styles.details}>
        {details.map((detail) => (
          <div className={styles.detail} key={detail.label}>
            <span className={styles.label}>{detail.label}</span>
            <span className={`${styles.value} ${styles[detail.tone ?? "neutral"]}`}>
              {detail.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
