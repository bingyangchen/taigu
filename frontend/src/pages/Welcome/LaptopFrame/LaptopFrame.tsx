import type { ReactElement } from "react";

import laptopFrame from "../../../assets/welcome/frame-laptop.webp";
import { makeWidthBelowQuery } from "../../../utils/mediaQuery";
import styles from "./LaptopFrame.module.scss";

// A transparent 1×1 GIF. The narrow layout gets it instead of the real images, so a
// laptop that only the wide layout shows costs phones no download.
const EMPTY_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

interface Props {
  // A screenshot of the app's wide layout at 1440×930 CSS px, the frame's screen ratio.
  src: string;
  alt: string;

  // Shows the laptop only in the wide layout and loads its images right away with a
  // high fetch priority, for a laptop in the first viewport.
  isWideOnlyPriority?: boolean;
  className?: string;
}

export default function LaptopFrame({
  src,
  alt,
  isWideOnlyPriority = false,
  className,
}: Props) {
  const loadingProps = isWideOnlyPriority
    ? ({ fetchPriority: "high" } as const)
    : ({ loading: "lazy" } as const);
  const renderForLayout = (image: ReactElement) =>
    isWideOnlyPriority ? (
      <picture>
        <source media={makeWidthBelowQuery("lg")} srcSet={EMPTY_IMAGE} />
        {image}
      </picture>
    ) : (
      image
    );

  return (
    <div
      className={`${styles.main} ${isWideOnlyPriority ? styles.wide_only : ""} ${className ?? ""}`}
    >
      <div className={styles.screen}>
        {renderForLayout(
          <img src={src} width={2880} height={1860} alt={alt} {...loadingProps} />,
        )}
      </div>
      {renderForLayout(
        <img className={styles.frame} src={laptopFrame} alt="" {...loadingProps} />,
      )}
    </div>
  );
}
