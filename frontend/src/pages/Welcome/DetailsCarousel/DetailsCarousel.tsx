import { useCallback, useEffect, useRef, useState } from "react";

import Button from "../../../components/Button/Button";
import Tooltip from "../../../components/Tooltip/Tooltip";
import * as Icons from "../../../icons";
import PhoneFrame, { PhoneScreenshot } from "../PhoneFrame/PhoneFrame";
import { type PhoneScreen, SCREENS } from "../screens";
import styles from "./DetailsCarousel.module.scss";

interface Tile {
  title: string;
  description: string;
  screen: PhoneScreen;
  alt: string;

  // The screen's content sits at its bottom, such as a sheet, so the tile shows the
  // phone's lower half.
  showsBottom?: boolean;
}

// A scroll position the track can reach, and the tiles that start there. Near the
// end of the track, several tiles share the last position, because the track cannot
// scroll a tile to its start once the remaining tiles fit in the view.
interface Stop {
  scrollLeft: number;
  tileTitles: string[];
}

type Direction = "previous" | "next";

const TILES: Tile[] = [
  {
    title: "現金股利",
    description: "記下每次入帳的股利，Taigu 依股票列出你領了多少，也一起算進報酬率。",
    screen: SCREENS.dividends,
    alt: "依股票列出累計領到的現金股利的長條圖",
  },
  {
    title: "大盤指數",
    description: "加權指數與櫃買指數的盤中走勢，開盤時跟著更新。",
    screen: SCREENS.marketIndex,
    alt: "加權指數與櫃買指數的盤中走勢",
  },
  {
    title: "公司資訊與重大消息",
    description: "主要經營業務與公開資訊觀測站的重大訊息，點進每檔股票就看得到。",
    screen: SCREENS.companyInfo,
    alt: "台積電的公司資訊：主要經營業務與兩則重大消息",
  },
  {
    title: "個股筆記",
    description: "替每檔股票寫下買進的理由，下次決定前再讀一次。",
    screen: SCREENS.stockMemo,
    alt: "台積電的個股筆記：長期核心持股，不追高",
    showsBottom: true,
  },
  {
    title: "買賣計畫",
    description: "先寫下目標價格與數量，價格接近目標時，會提示還差多少。",
    screen: SCREENS.tradePlans,
    alt: "買賣計畫列表：台積電目標價 $2,080 買進 20 股",
  },
  {
    title: "手續費折讓",
    description: "記下券商退還的手續費，算出你實際付了多少。",
    screen: SCREENS.handlingFee,
    alt: "累積手續費與每月手續費的長條圖",
  },
];

// Before the first layout the track shows one tile per stop.
const INITIAL_STOPS: Stop[] = TILES.map((tile) => ({
  scrollLeft: 0,
  tileTitles: [tile.title],
}));

// A finite carousel on native scroll snapping. Buttons only start scrolls; the
// current stop is always read back from the scroll position.
export default function DetailsCarousel({ labelledBy }: { labelledBy: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLElement | null)[]>([]);
  const controlsRef = useRef<HTMLDivElement>(null);

  // The stop a button click is scrolling to, so rapid clicks build on it rather than
  // on the stop the scroll has not left yet.
  const pendingIndexRef = useRef<number | null>(null);
  const settledIndexRef = useRef(0);
  const [stops, setStops] = useState<Stop[]>(INITIAL_STOPS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const makeStops = useCallback((track: HTMLElement, tiles: HTMLElement[]): Stop[] => {
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    const nextStops: Stop[] = [];
    tiles.forEach((tile, index) => {
      const scrollLeft = Math.min(tile.offsetLeft - tiles[0].offsetLeft, maxScrollLeft);
      const last = nextStops.at(-1);
      if (last && Math.abs(last.scrollLeft - scrollLeft) < 1) {
        last.tileTitles.push(TILES[index].title);
      } else {
        nextStops.push({ scrollLeft, tileTitles: [TILES[index].title] });
      }
    });
    return nextStops;
  }, []);

  const getNearestIndex = useCallback((currentStops: Stop[]): number => {
    const scrollLeft = trackRef.current?.scrollLeft ?? 0;
    let nearest = 0;
    currentStops.forEach((stop, index) => {
      if (
        Math.abs(stop.scrollLeft - scrollLeft) <
        Math.abs(currentStops[nearest].scrollLeft - scrollLeft)
      ) {
        nearest = index;
      }
    });
    return nearest;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const tiles = tileRefs.current;
    if (!track || tiles.some((tile) => !tile)) {
      throw new Error("The carousel's track and tiles render before its effects run.");
    }
    const updateStops = (): void => {
      const nextStops = makeStops(track, tiles as HTMLElement[]);
      setStops(nextStops);
      setCurrentIndex(getNearestIndex(nextStops));
    };
    updateStops();
    const observer = new ResizeObserver(updateStops);
    observer.observe(track);
    return () => observer.disconnect();
  }, [makeStops, getNearestIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) throw new Error("The carousel's track renders before its effects run.");
    let frame = 0;
    const handleScroll = (): void => {
      if (pendingIndexRef.current !== null || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCurrentIndex(getNearestIndex(stops));
      });
    };
    const handleSettle = (): void => {
      pendingIndexRef.current = null;
      const index = getNearestIndex(stops);
      setCurrentIndex(index);
      if (index !== settledIndexRef.current) {
        setAnnouncement(stops[index].tileTitles.join("、"));
      }
      settledIndexRef.current = index;
    };

    // Safari before 26.2 has no scrollend; a pause in scroll events stands in for it.
    let settleTimer = 0;
    const handleScrollForSettle = (): void => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(handleSettle, 120);
    };
    const hasScrollEnd = "onscrollend" in window;
    track.addEventListener("scroll", handleScroll, { passive: true });
    if (hasScrollEnd) track.addEventListener("scrollend", handleSettle);
    else track.addEventListener("scroll", handleScrollForSettle, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      track.removeEventListener("scroll", handleScroll);
      track.removeEventListener("scrollend", handleSettle);
      track.removeEventListener("scroll", handleScrollForSettle);
    };
  }, [stops, getNearestIndex]);

  const scrollToStop = (index: number): number => {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(stops.length - 1, index));
    setCurrentIndex(target);
    if (!track) return target;

    // A scroll to where the track already is fires no scroll events, so nothing
    // would clear the pending stop.
    if (Math.abs(track.scrollLeft - stops[target].scrollLeft) < 1) return target;
    pendingIndexRef.current = target;
    track.scrollTo({ left: stops[target].scrollLeft });
    return target;
  };

  const handleArrowClick = (direction: Direction): void => {
    const step = direction === "next" ? 1 : -1;
    const target = scrollToStop(
      (pendingIndexRef.current ?? getNearestIndex(stops)) + step,
    );

    // The clicked button is about to become disabled, which would drop focus to the
    // page; hand focus to the other button first.
    const reachesEnd =
      direction === "next" ? target === stops.length - 1 : target === 0;
    if (reachesEnd) {
      const other: Direction = direction === "next" ? "previous" : "next";
      controlsRef.current
        ?.querySelector<HTMLButtonElement>(`[data-direction="${other}"]`)
        ?.focus();
    }
  };

  return (
    <div
      className={styles.main}
      role="group"
      aria-roledescription="carousel"
      aria-labelledby={labelledBy}
    >
      <div
        ref={trackRef}
        className={styles.track}
        // A scrolling region must take keyboard focus so arrow keys can scroll it
        // (WCAG 2.1.1); the rule does not know that a scroller is interactive.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="group"
        aria-label="功能卡片"
      >
        {TILES.map((tile, index) => (
          <article
            key={tile.title}
            ref={(element) => {
              tileRefs.current[index] = element;
            }}
            className={styles.tile}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${TILES.length}`}
          >
            <div className={styles.tile_copy}>
              <h3>{tile.title}</h3>
              <p>{tile.description}</p>
            </div>
            <div
              className={`${styles.tile_shot} ${tile.showsBottom ? styles.shows_bottom : ""}`}
            >
              <PhoneFrame className={styles.tile_phone}>
                <PhoneScreenshot screen={tile.screen} alt={tile.alt} />
              </PhoneFrame>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.visually_hidden} role="status" aria-live="polite">
        {announcement}
      </p>
      <div ref={controlsRef} className={styles.controls}>
        <div className={styles.markers} role="group" aria-label="選擇要看的功能">
          {stops.map((stop, index) => {
            const name = stop.tileTitles.join("、");
            return (
              <Tooltip key={name} content={name} side="top">
                <button
                  type="button"
                  aria-label={name}
                  aria-current={index === currentIndex}
                  onClick={() => scrollToStop(index)}
                />
              </Tooltip>
            );
          })}
        </div>
        <Tooltip content="上一個" side="top">
          <Button
            data-direction="previous"
            variant="light"
            round
            className={styles.arrow}
            aria-label="上一個"
            disabled={currentIndex === 0}
            onClick={() => handleArrowClick("previous")}
          >
            <Icons.IconChevronLeft sideLength="14" />
          </Button>
        </Tooltip>
        <Tooltip content="下一個" side="top">
          <Button
            data-direction="next"
            variant="light"
            round
            className={styles.arrow}
            aria-label="下一個"
            disabled={currentIndex === stops.length - 1}
            onClick={() => handleArrowClick("next")}
          >
            <Icons.IconChevronRight sideLength="14" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
