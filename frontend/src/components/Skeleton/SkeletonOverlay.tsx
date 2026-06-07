import React from "react";

import styles from "./Skeleton.module.scss";

interface Props extends React.HTMLAttributes<HTMLDivElement> {}

export default function SkeletonOverlay({
  className,
  ...rest
}: Props): React.ReactElement {
  return (
    <div
      className={[styles.overlay, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      {...rest}
    />
  );
}
