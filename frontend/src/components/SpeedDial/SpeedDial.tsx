import { type MouseEvent, useCallback, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Tooltip } from "../../components";
import * as Icons from "../../icons";
import Env from "../../utils/env";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import { useLatestRef } from "../../utils/useLatestRef";
import styles from "./SpeedDial.module.scss";

interface Props {
  defaultSid?: string;
}

const OPEN_HASH = "#@";

/** The add button of the narrow layout (REC-R10); the wide layout has the sidebar. */
export default function SpeedDial(props: Props) {
  return useIsNarrowLayout() ? <NarrowSpeedDial {...props} /> : null;
}

function NarrowSpeedDial({ defaultSid }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.hash === OPEN_HASH;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const previousOverscrollRef = useRef<string | null>(null);
  const lastHashRef = useRef(location.hash);

  const latestRenderRef = useLatestRef({ isActive, location, navigate });

  // Closing the menu takes focus out of the options, and no hook runs between the
  // render and that DOM update, so the render reads whether focus was in them while
  // the DOM still shows the open menu.
  const focusWasInOptions =
    lastHashRef.current === OPEN_HASH &&
    !isActive &&
    (optionsRef.current?.contains(document.activeElement) ?? false);

  const hide = useCallback((): void => {
    const { isActive: latestIsActive, location: latestLocation } =
      latestRenderRef.current;
    if (!latestIsActive) return;
    if (latestLocation.state?.speedDialOpen === true) {
      latestRenderRef.current.navigate(-1);
    } else {
      latestRenderRef.current.navigate(
        { search: latestLocation.search, hash: "" },
        { replace: true, state: latestLocation.state },
      );
    }
  }, [latestRenderRef]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !latestRenderRef.current.isActive
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      triggerRef.current?.focus();
      hide();
    },
    [hide, latestRenderRef],
  );

  const restoreOverscroll = useCallback((): void => {
    window.removeEventListener("keydown", handleKeyDown, true);
    if (previousOverscrollRef.current === null) return;
    document.body.style.overscrollBehaviorY = previousOverscrollRef.current;
    previousOverscrollRef.current = null;
  }, [handleKeyDown]);

  const syncOverscroll = useCallback((): void => {
    if (latestRenderRef.current.isActive) {
      previousOverscrollRef.current ??= document.body.style.overscrollBehaviorY;
      document.body.style.overscrollBehaviorY = "contain";
      window.addEventListener("keydown", handleKeyDown, true);
    } else {
      restoreOverscroll();
    }
  }, [handleKeyDown, latestRenderRef, restoreOverscroll]);

  useLayoutEffect(() => {
    syncOverscroll();
    return restoreOverscroll;
  }, [syncOverscroll, restoreOverscroll]);

  useLayoutEffect(() => {
    const previousHash = lastHashRef.current;
    lastHashRef.current = location.hash;
    if (previousHash !== location.hash) syncOverscroll();
    if (focusWasInOptions) triggerRef.current?.focus({ preventScroll: true });
  });

  const defaultSidSearch = defaultSid ? `?sid=${encodeURIComponent(defaultSid)}` : "";

  const toggle = (event: MouseEvent): void => {
    event.stopPropagation();
    if (isActive) {
      hide();
      return;
    }
    navigate(
      { search: location.search, hash: OPEN_HASH },
      { state: { ...location.state, speedDialOpen: true } },
    );
  };
  // Replaces the open menu's history entry, so Back from the page skips the menu.
  const makeNavigationHandler =
    (path: string) =>
    (e: MouseEvent): void => {
      e.stopPropagation();
      navigate(path, { replace: isActive });
    };

  return (
    <>
      <div className={`${styles.main} ${isActive ? styles.active : ""}`}>
        <Tooltip content="新增或搜尋" side="left">
          <button
            type="button"
            className={styles.trigger}
            ref={triggerRef}
            aria-label="新增或搜尋"
            aria-expanded={isActive}
            onClick={toggle}
          >
            <Icons.IconPlus sideLength="26" />
          </button>
        </Tooltip>
        <div className={styles.button_container} ref={optionsRef}>
          <button
            type="button"
            className={styles.button}
            onClick={makeNavigationHandler(
              `${Env.frontendRootPath}records/trade/new${defaultSidSearch}`,
            )}
          >
            <Icons.IconPencilSquare sideLength="20" />
            <span className={styles.hint_text}>新增交易紀錄</span>
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={makeNavigationHandler(
              `${Env.frontendRootPath}records/cash-dividend/new${defaultSidSearch}`,
            )}
          >
            <Icons.IconCoin sideLength="20" />
            <span className={styles.hint_text}>新增現金股利</span>
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={makeNavigationHandler(
              `${Env.frontendRootPath}plans/new${defaultSidSearch}`,
            )}
          >
            <Icons.IconThumbtack sideLength="20" />
            <span className={styles.hint_text}>新增買賣計畫</span>
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={makeNavigationHandler(`${Env.frontendRootPath}search`)}
          >
            <Icons.IconMagnifier sideLength="20" />
            <span className={styles.hint_text}>搜尋</span>
          </button>
        </div>
      </div>
      <div className={styles.background} onClick={hide} />
    </>
  );
}
