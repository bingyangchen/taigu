import React, { KeyboardEvent } from "react";

import * as Icons from "../../icons";
import styles from "./SummaryCard.module.scss";

interface Props {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export default function SummaryCard({ title, children, onClick }: Props) {
  const isClickable = !!onClick;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`${styles.summary_card} ${isClickable ? styles.clickable : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
    >
      <div className={styles.title}>{title}</div>
      <div className={styles.price}>{children}</div>
      {isClickable && (
        <div className={styles.chevron}>
          <Icons.IconChevronRight sideLength="12" />
        </div>
      )}
    </div>
  );
}
