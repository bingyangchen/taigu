import React from "react";

import styles from "./Skeleton.module.scss";

export type SkeletonSize = "large" | "small" | "full" | "medium" | "badge";

const SIZE_CLASS: Record<SkeletonSize, string> = {
  large: styles.lineLarge,
  small: styles.lineSmall,
  full: styles.lineFull,
  medium: styles.lineMedium,
  badge: styles.badge,
};

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SkeletonSize;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export default function Skeleton({
  className,
  size,
  width,
  height,
  borderRadius,
  style,
  ...rest
}: Props): React.ReactElement {
  return (
    <span
      className={[styles.skeleton, size ? SIZE_CLASS[size] : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}
