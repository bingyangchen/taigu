import React from "react";

import { useAppSelector } from "../../redux/hooks";

const DEFAULT_THRESHOLD = 120;

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: React.ReactNode | ((isScrolled: boolean) => React.ReactElement | null);
  scrolledClassName?: string;
  threshold?: number;
}

export default function ScrollThresholdContainer({
  children,
  className,
  scrolledClassName,
  threshold,
  ...rest
}: Props): React.ReactElement | null {
  const scrollTop = useAppSelector((state) => state.mainPage.scrollTop);
  const isScrolled = scrollTop > (threshold ?? DEFAULT_THRESHOLD);
  if (typeof children === "function") return children(isScrolled);
  return (
    <div
      {...rest}
      className={`${className ?? ""} ${isScrolled ? (scrolledClassName ?? "") : ""}`}
    >
      {children}
    </div>
  );
}
