import { type MouseEvent, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Tooltip } from "../../components";
import * as Icons from "../../icons";
import Env from "../../utils/env";
import { goBackInHistory } from "../../utils/modal";
import { useLatestRef } from "../../utils/useLatestRef";
import Util from "../../utils/util";
import AddOrSearchModal, {
  type AddOrSearchModalName,
} from "../AddOrSearchModal/AddOrSearchModal";
import styles from "./SpeedDial.module.scss";

interface Props {
  defaultSid?: string;
}

const OPEN_HASH = "#@";

export default function SpeedDial({ defaultSid }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeModalName, setActiveModalName] = useState<AddOrSearchModalName | null>(
    null,
  );
  const isActive = location.hash === OPEN_HASH;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const previousOverscrollRef = useRef<string | null>(null);
  const lastCommitRef = useRef({ hash: location.hash, activeModalName });

  const latestRenderRef = useLatestRef({
    isActive,
    activeModalName,
    location,
    navigate,
  });

  // Closing the menu takes focus out of the options. Whether focus was in them has
  // to be read before the update reaches the DOM, as getSnapshotBeforeUpdate did, and
  // no hook runs at that point, so the render reads it while the DOM still shows the
  // open menu.
  const focusWasInOptions =
    lastCommitRef.current.hash === OPEN_HASH &&
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
      const { isActive: latestIsActive, activeModalName: latestModalName } =
        latestRenderRef.current;
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !latestIsActive ||
        latestModalName
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
    const previous = lastCommitRef.current;
    lastCommitRef.current = { hash: location.hash, activeModalName };
    if (previous.hash !== location.hash) syncOverscroll();
    if (activeModalName) return;
    if (previous.activeModalName) {
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    } else if (focusWasInOptions) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  });

  const hideModal = (): void => setActiveModalName(null);
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
  const openModalAfterHiding = async (
    modalName: AddOrSearchModalName,
  ): Promise<void> => {
    // The modal pushes its own history entry, which must come after the menu's entry
    // is gone; pushing it while that Back is still pending lets the Back close it.
    if (isActive && location.state?.speedDialOpen === true) {
      await goBackInHistory(1);
    } else {
      hide();
    }
    setActiveModalName(modalName);
  };
  const openEditorRouteOrModal = (
    mobilePath: string,
    modalName: Exclude<AddOrSearchModalName, "search">,
  ): void => {
    if (Util.isMobile) {
      navigate(mobilePath, { replace: isActive });
      return;
    }
    void openModalAfterHiding(modalName);
  };
  const handleCreateTradeRecord = (e: MouseEvent): void => {
    e.stopPropagation();
    openEditorRouteOrModal(
      `${Env.frontendRootPath}records/trade/new${defaultSidSearch}`,
      "createTradeRecord",
    );
  };
  const handleCreateCashDividendRecord = (e: MouseEvent): void => {
    e.stopPropagation();
    openEditorRouteOrModal(
      `${Env.frontendRootPath}records/cash-dividend/new${defaultSidSearch}`,
      "createCashDividendRecord",
    );
  };
  const handleCreateTradePlan = (e: MouseEvent): void => {
    e.stopPropagation();
    openEditorRouteOrModal(
      `${Env.frontendRootPath}plans/new${defaultSidSearch}`,
      "createTradePlan",
    );
  };
  const handleSearch = (e: MouseEvent): void => {
    e.stopPropagation();
    if (Util.isMobile) {
      navigate(`${Env.frontendRootPath}search`, { replace: isActive });
      return;
    }
    void openModalAfterHiding("search");
  };

  return (
    <>
      {activeModalName && (
        <AddOrSearchModal
          modalName={activeModalName}
          defaultSid={defaultSid}
          hideModal={hideModal}
        />
      )}
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
            onClick={handleCreateTradeRecord}
          >
            <Icons.IconPencilSquare sideLength="20" />
            <span className={styles.hint_text}>新增交易紀錄</span>
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={handleCreateCashDividendRecord}
          >
            <Icons.IconCoin sideLength="20" />
            <span className={styles.hint_text}>新增現金股利</span>
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={handleCreateTradePlan}
          >
            <Icons.IconThumbtack sideLength="20" />
            <span className={styles.hint_text}>新增買賣計畫</span>
          </button>
          <button type="button" className={styles.button} onClick={handleSearch}>
            <Icons.IconMagnifier sideLength="20" />
            <span className={styles.hint_text}>搜尋</span>
          </button>
        </div>
      </div>
      <div className={styles.background} onClick={hide} />
    </>
  );
}
