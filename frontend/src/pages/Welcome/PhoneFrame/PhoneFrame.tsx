import type { CSSProperties, ReactNode } from "react";

import phoneFrame from "../../../assets/welcome/frame-phone.webp";
import { makeWidthAtLeastQuery } from "../../../utils/mediaQuery";
import { type PhoneScreen, SCREENSHOT_HEIGHT, SCREENSHOT_WIDTH } from "../screens";
import styles from "./PhoneFrame.module.scss";

interface ScreenshotProps {
  screen: PhoneScreen;

  // Shown instead of `screen` in the wide layout.
  wideScreen?: PhoneScreen;

  // Describes the screenshot. Leave it empty when nearby text already says what the
  // screen shows.
  alt: string;

  // Loads the screenshot right away with a high fetch priority, for a phone in the
  // first viewport.
  priority?: boolean;
}

// A screenshot of the app below the status bar, with the status bar and the home
// indicator band filled in its own top and bottom colors.
export function PhoneScreenshot({
  screen,
  wideScreen,
  alt,
  priority = false,
}: ScreenshotProps) {
  const screenColors = {
    "--screen-top": screen.topColor,
    "--screen-bottom": screen.bottomColor,
    "--wide-screen-top": wideScreen?.topColor,
    "--wide-screen-bottom": wideScreen?.bottomColor,
  } as CSSProperties;
  const image = (
    <img
      src={screen.src}
      width={SCREENSHOT_WIDTH}
      height={SCREENSHOT_HEIGHT}
      alt={alt}
      loading={priority ? undefined : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );

  return (
    <div
      className={`${styles.screenshot} ${wideScreen ? styles.has_wide_screen : ""}`}
      style={screenColors}
    >
      <div className={styles.status_bar} />
      <div className={styles.viewport}>
        {wideScreen ? (
          <picture>
            <source media={makeWidthAtLeastQuery("lg")} srcSet={wideScreen.src} />
            {image}
          </picture>
        ) : (
          image
        )}
      </div>
      <div className={styles.home_bar} />
    </div>
  );
}

interface Props {
  // What fills the whole screen, status bar included: a PhoneScreenshot, a screen
  // recording, or several of them that swap in place.
  children: ReactNode;

  // Loads the frame right away, for a phone in the first viewport.
  priority?: boolean;
  className?: string;
}

export default function PhoneFrame({ children, priority = false, className }: Props) {
  return (
    <div className={`${styles.main} ${className ?? ""}`}>
      <div className={styles.screen}>
        {children}
        <div className={styles.home_indicator} />
      </div>
      <img
        className={styles.frame}
        src={phoneFrame}
        alt=""
        loading={priority ? undefined : "lazy"}
      />
    </div>
  );
}
