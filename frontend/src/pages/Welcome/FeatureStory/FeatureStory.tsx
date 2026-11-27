import { useEffect, useRef, useState } from "react";

import dashboardScrollVideo from "../../../assets/welcome/dashboard-scroll.mp4";
import dashboardScrollPoster from "../../../assets/welcome/dashboard-scroll-poster.webp";
import holdingsScrollVideo from "../../../assets/welcome/holdings-scroll.mp4";
import holdingsScrollPoster from "../../../assets/welcome/holdings-scroll-poster.webp";
import recordTradeVideo from "../../../assets/welcome/record-trade.mp4";
import recordTradePoster from "../../../assets/welcome/record-trade-poster.webp";
import Button from "../../../components/Button/Button";
import * as Icons from "../../../icons";
import { makeWidthAtLeastQuery } from "../../../utils/mediaQuery";
import PhoneFrame from "../PhoneFrame/PhoneFrame";
import styles from "./FeatureStory.module.scss";

// Each recording fills the phone's whole 390×844 screen, status bar included: the
// status bar and the home indicator band repeat each frame's top and bottom rows.
interface Step {
  title: string;
  description: string;
  video: string;

  // The frame shown before the video plays, and instead of it when it does not.
  poster: string;
  videoDescription: string;
}

// Where a step's video plays: the wide layout's sticky phone, or the phone inside
// the step in the narrow layout.
type VideoPlace = "stage" | "step";

const STEPS: Step[] = [
  {
    title: "記一筆交易，十秒就好。",
    description:
      "選好股票，填上股數和成交價，就記好了。手續費依公定費率自動試算，賣出時連證交稅一起算；零股、整張都能記。",
    video: recordTradeVideo,
    poster: recordTradePoster,
    videoDescription:
      "示範影片：新增一筆台積電 30 股、成交單價 2,150 元的買進紀錄，手續費自動試算為 91 元，存好之後，紀錄列表最上方多了這一筆",
  },
  {
    title: "持股與成本，自動整理。",
    description:
      "每檔股票的庫存、平均成本和報酬率，都從你的紀錄算出來。賣出時，依先買先賣扣掉成本。",
    video: holdingsScrollVideo,
    poster: holdingsScrollPoster,
    videoDescription:
      "示範影片：在持股列表點台積電，往下捲過今天的走勢、投資摘要、庫存分佈與重大消息",
  },
  {
    title: "一眼看懂你的投資。",
    description:
      "投入金額怎麼一路變化、錢分在哪幾檔股票、每一檔賺了多少，都畫成清楚的圖表。年化報酬率以 XIRR 計算，每筆投入的時間點都算進去。",
    video: dashboardScrollVideo,
    poster: dashboardScrollPoster,
    videoDescription:
      "示範影片：投入金額的走勢切換到全部期間，再往下捲到持股配置的圓餅圖、年化報酬率與實現損益",
  },
];

const getVideoKey = (place: VideoPlace, stepIndex: number): string =>
  `${place}-${stepIndex}`;

// The steps scroll past a phone. In the wide layout one sticky phone plays the video
// of the step nearest the viewport's middle; in the narrow layout each step plays its
// own phone's video while it is on screen.
export default function FeatureStory() {
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const keyToVideo = useRef(new Map<string, HTMLVideoElement>());
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isWide, setIsWide] = useState(false);
  const [visibleVideoKeys, setVisibleVideoKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [focusedToggleKey, setFocusedToggleKey] = useState<string | null>(null);

  useEffect(() => {
    const wideQuery = window.matchMedia(makeWidthAtLeastQuery("lg"));
    const handleChange = (): void => setIsWide(wideQuery.matches);
    handleChange();
    wideQuery.addEventListener("change", handleChange);
    return () => wideQuery.removeEventListener("change", handleChange);
  }, []);

  // WCAG 2.2.2: looping videos do not start on their own for users who ask for
  // reduced motion; they can still play them with the button.
  useEffect(() => {
    setIsVideoPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setActiveStepIndex(stepRefs.current.indexOf(entry.target as HTMLLIElement));
        }
      },

      // A thin band across the viewport's middle, so one step is active at a time.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        setVisibleVideoKeys((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const key = (entry.target as HTMLVideoElement).dataset.key as string;
            if (entry.isIntersecting) next.add(key);
            else next.delete(key);
          }
          return next;
        }),
      { threshold: 0.4 },
    );
    keyToVideo.current.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  }, []);

  const isVideoOnScreen = (place: VideoPlace, stepIndex: number): boolean =>
    isWide
      ? place === "stage" &&
        stepIndex === activeStepIndex &&
        visibleVideoKeys.has(getVideoKey("stage", stepIndex))
      : place === "step" && visibleVideoKeys.has(getVideoKey("step", stepIndex));

  // The keys of the videos on screen now; a string, so the effect below runs only when
  // the set changes.
  const onScreenVideoKeys = STEPS.flatMap((_, stepIndex) =>
    (["stage", "step"] as const)
      .filter((place) => isVideoOnScreen(place, stepIndex))
      .map((place) => getVideoKey(place, stepIndex)),
  ).join(" ");
  const previousOnScreenKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const keys = new Set(onScreenVideoKeys.split(" "));
    keyToVideo.current.forEach((video, key) => {
      if (!keys.has(key) || isVideoPaused) {
        video.pause();
        return;
      }

      // A video starts over when it comes into view, so a visitor sees it whole; a
      // video the visitor resumes continues where it stopped.
      if (!previousOnScreenKeysRef.current.has(key)) video.currentTime = 0;
      if (!video.paused) return;
      video.preload = "auto";
      video.play().catch((error: unknown) => {
        // A browser may refuse to play on its own, for example in power-saving
        // mode; the poster then stays and the button offers to play. A play cut
        // short by a later pause() rejects with AbortError and needs nothing.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setIsVideoPaused(true);
          return;
        }
        if (!(error instanceof DOMException && error.name === "AbortError"))
          throw error;
      });
    });
    previousOnScreenKeysRef.current = keys;
  }, [onScreenVideoKeys, isVideoPaused]);

  const renderVideo = (place: VideoPlace, stepIndex: number) => {
    const step = STEPS[stepIndex];
    const key = getVideoKey(place, stepIndex);
    return (
      <video
        ref={(video) => {
          if (video) keyToVideo.current.set(key, video);
          else keyToVideo.current.delete(key);
        }}
        data-key={key}
        src={step.video}
        poster={step.poster}
        muted
        playsInline
        loop
        preload="none"
        aria-label={step.videoDescription}
      />
    );
  };

  // The button keeps its space while hidden, so the page below it does not jump as
  // a video scrolls in and out of view.
  const renderVideoToggle = (place: VideoPlace, stepIndex: number) => {
    const key = getVideoKey(place, stepIndex);
    const isShown = isVideoOnScreen(place, stepIndex) || focusedToggleKey === key;
    return (
      <Button
        variant="light"
        size="s"
        round
        className={`${styles.video_toggle} ${isShown ? "" : styles.hidden}`}
        onFocus={() => setFocusedToggleKey(key)}
        onBlur={() => setFocusedToggleKey(null)}
        onClick={() => setIsVideoPaused((paused) => !paused)}
      >
        {isVideoPaused ? (
          <Icons.IconPlay sideLength="12" />
        ) : (
          <Icons.IconPause sideLength="12" />
        )}
        {isVideoPaused ? "播放示範影片" : "暫停示範影片"}
      </Button>
    );
  };

  return (
    <div className={styles.main}>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            ref={(element) => {
              stepRefs.current[index] = element;
            }}
            className={`${styles.step} ${index === activeStepIndex ? styles.active : ""}`}
          >
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <figure className={styles.step_figure}>
              <PhoneFrame>{renderVideo("step", index)}</PhoneFrame>
              {renderVideoToggle("step", index)}
            </figure>
          </li>
        ))}
      </ol>

      <div className={styles.stage}>
        <PhoneFrame className={styles.stage_phone}>
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className={`${styles.layer} ${index === activeStepIndex ? styles.active : ""}`}
              aria-hidden={index !== activeStepIndex}
            >
              {renderVideo("stage", index)}
            </div>
          ))}
        </PhoneFrame>
        {renderVideoToggle("stage", activeStepIndex)}
      </div>
    </div>
  );
}
