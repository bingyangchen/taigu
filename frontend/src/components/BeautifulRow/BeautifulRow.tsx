import React, { MouseEvent, MouseEventHandler, useState } from "react";

import * as Icons from "../../icons";
import styles from "./BeautifulRow.module.scss";

interface Props {
  label?: string;
  children?: React.ReactNode | string;
  onClick?: MouseEventHandler;
}

interface Ripple {
  diameter: number;
  left: number;
  top: number;
}

export default function BeautifulRow({ label, children, onClick }: Props) {
  const [ripple, setRipple] = useState<Ripple | null>(null);

  const handleClick = (e: MouseEvent): void => {
    if (!onClick) return;
    const mask = e.currentTarget as HTMLElement;
    const diameter = Math.max(mask.clientWidth, mask.clientHeight);
    const maskRect = mask.getBoundingClientRect();
    setRipple({
      diameter,
      left: e.clientX - maskRect.left - diameter / 2,
      top: e.clientY - maskRect.top - diameter / 2,
    });
    setTimeout(() => {
      setRipple(null);
      onClick(e);
    }, 250);
  };

  return (
    <div className={`${styles.main} ${onClick ? styles.reactive : ""}`}>
      <div className={styles.mask} onClick={handleClick}>
        {ripple && (
          <div
            className={styles.ripple}
            style={{
              width: `${ripple.diameter}px`,
              height: `${ripple.diameter}px`,
              left: `${ripple.left}px`,
              top: `${ripple.top}px`,
            }}
          />
        )}
      </div>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.value}>
        {typeof children === "string" ? renderLines(children) : children}
      </div>
      {onClick && (
        <div className={styles.tail_mark}>
          <Icons.IconChevronRight sideLength="13" />
        </div>
      )}
    </div>
  );
}

function renderLines(text: string): React.ReactNode {
  return text.split("\n").map((line, index) => (
    <div key={index} className={styles.s}>
      {line || " "}
    </div>
  ));
}
