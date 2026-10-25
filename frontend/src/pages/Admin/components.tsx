import React from "react";

import { Button, Skeleton } from "../../components";
import styles from "./components.module.scss";
import { formatCount } from "./format";

export function PageHead({
  title,
  description,
  tools,
}: {
  title: string;
  description?: string;
  tools?: React.ReactNode;
}): React.ReactElement {
  return (
    <header className={styles.page_head}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {tools}
    </header>
  );
}

export function Section({
  title,
  caption,
  tools,
  children,
}: {
  title: string;
  caption?: React.ReactNode;
  tools?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className={styles.section}>
      <div className={styles.section_head}>
        <div>
          <h2>{title}</h2>
          {caption && <div className={styles.caption}>{caption}</div>}
        </div>
        {tools}
      </div>
      {children}
    </section>
  );
}

export function StateMessage({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <div className={styles.state}>{children}</div>;
}

export function LoadFailure({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className={styles.state} role="alert">
      無法載入資料。
      <Button className={`white border s ${styles.touch_button}`} onClick={onRetry}>
        重新載入
      </Button>
    </div>
  );
}

export function SkeletonRows({ count }: { count: number }): React.ReactElement {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeleton_row}>
          <Skeleton size="full" />
        </div>
      ))}
    </div>
  );
}

export function Muted({ children }: { children: React.ReactNode }): React.ReactElement {
  return <span className={styles.muted}>{children}</span>;
}

export function Change({ value }: { value: number | null }): React.ReactElement | null {
  if (value === null) return null;
  if (value === 0) return <Muted>±0 人</Muted>;
  return value > 0 ? (
    <span className={styles.up}>▲ +{formatCount(value)} 人</span>
  ) : (
    <span className={styles.down}>▼ −{formatCount(-value)} 人</span>
  );
}

export function Metric({
  label,
  value,
  change,
  pendingText,
}: {
  label: string;
  value: number | null;

  /** Leave it out for a number that is never compared. */
  change?: number | null;
  pendingText?: string;
}): React.ReactElement {
  return (
    <div className={styles.metric}>
      <div className={styles.metric_label}>{label}</div>
      {value === null ? (
        <div className={`${styles.metric_value} ${styles.pending}`}>{pendingText}</div>
      ) : (
        <div className={styles.metric_value}>
          {formatCount(value)}
          <small>人</small>
        </div>
      )}
      {change !== undefined && (
        <div className={styles.metric_change}>
          <Change value={change} />
        </div>
      )}
    </div>
  );
}

export function MetricsSkeleton({ count }: { count: number }): React.ReactElement {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.metric}>
          <Skeleton size="small" width="50%" />
          <Skeleton height={30} width="40%" />
        </div>
      ))}
    </>
  );
}
