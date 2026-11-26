import React, { MouseEventHandler } from "react";

import Tooltip from "../Tooltip/Tooltip";
import styles from "./RoundButton.module.scss";

interface Props {
  children: React.ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  size?: "m" | "l";
  frosted?: boolean;
  disabled?: boolean;
  hint_text?: string;
  "aria-label"?: string;
}

export default function RoundButton({
  children,
  onClick,
  className,
  size,
  frosted,
  disabled,
  hint_text,
  "aria-label": ariaLabel,
}: Props) {
  const button = (
    <button
      type="button"
      aria-label={ariaLabel ?? hint_text}
      className={[
        styles.main,
        size === "l" && styles.l,
        frosted && styles.frosted,
        disabled && styles.disabled,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={disabled ? () => {} : (onClick ?? (() => {}))}
      disabled={disabled}
    >
      {children}
    </button>
  );

  if (!hint_text) return button;
  return <Tooltip content={hint_text}>{button}</Tooltip>;
}
