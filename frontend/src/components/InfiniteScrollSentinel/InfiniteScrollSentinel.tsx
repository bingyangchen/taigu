import React, { useEffect, useRef } from "react";

import styles from "./InfiniteScrollSentinel.module.scss";

interface Props {
  hasMore: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

export default function InfiniteScrollSentinel({
  hasMore,
  onLoadMore,
  rootMargin = "360px 0px",
}: Props): React.ReactElement | null {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinelElement = sentinelRef.current;
    if (!hasMore || !sentinelElement) return;

    if (!("IntersectionObserver" in window)) {
      onLoadMore();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(sentinelElement);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, rootMargin]);

  if (!hasMore) return null;

  return <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />;
}
