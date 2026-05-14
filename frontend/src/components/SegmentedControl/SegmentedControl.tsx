import * as Tabs from "@radix-ui/react-tabs";
import React from "react";

import styles from "./SegmentedControl.module.scss";

export interface SegmentedControlOption {
  label: React.ReactNode;
  value: string;
}

interface Props {
  label: string;
  options: SegmentedControlOption[];
  value: string;
  onChange: React.Dispatch<string>;
  className?: string;
  optionWidth?: string;
  variant?: "subtle" | "floating";
}

export default function SegmentedControl({
  className = "",
  label,
  onChange,
  optionWidth = "65px",
  options,
  value,
  variant = "subtle",
}: Props): React.ReactElement {
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  return (
    <Tabs.Root
      className={`${styles.main} ${styles[variant]} ${className}`}
      value={value}
      onValueChange={onChange}
    >
      <Tabs.List
        aria-label={label}
        className={styles.list}
        style={
          {
            "--active-index": activeIndex,
            "--option-count": options.length,
            "--option-width": optionWidth,
          } as React.CSSProperties
        }
      >
        <div className={styles.sliding_background} />
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            className={styles.trigger}
            value={option.value}
          >
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
