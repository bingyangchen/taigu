import {
  MouseEventHandler,
  ReactNode,
  TouchEvent,
  useId,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { BottomSheet, ListRowActionBar } from "../../components";
import {
  CashDividendRecord,
  HandlingFeeDiscount,
  TradePlan,
  TradeRecord,
} from "../../types";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import styles from "./ListRow.module.scss";

interface Props {
  target: TradeRecord | CashDividendRecord | TradePlan | HandlingFeeDiscount;
  children: ReactNode;
  editModal: ((_hideModal: MouseEventHandler) => ReactNode) | null;
  deleteModal: ((_hideModal: MouseEventHandler) => ReactNode) | null;
  editPath: string;
}

interface Ripple {
  diameter: number;
  left: number;
  top: number;
}

const LONG_PRESS_MS = 500;

/** A list row that opens its editor when clicked (REC-R11) and offers deleting (REC-R9). */
export default function ListRow({ children, editModal, deleteModal, editPath }: Props) {
  const navigate = useNavigate();
  const isNarrowLayout = useIsNarrowLayout();
  const contentId = useId();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const [activeModalName, setActiveModalName] = useState<"edit" | "checkDelete" | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasLongPressedRef = useRef(false);

  const hideModal = (): void => setActiveModalName(null);
  const openEditor = (): void => {
    if (isNarrowLayout) {
      navigate(editPath);
      return;
    }
    setActiveModalName("edit");
  };
  const handleClickDelete = (): void => setActiveModalName("checkDelete");

  const handleTouchStart = (e: TouchEvent): void => {
    hasLongPressedRef.current = false;
    timerRef.current = setTimeout(() => {
      hasLongPressedRef.current = true;
      if (isNarrowLayout) setIsBottomSheetOpen(true);
    }, LONG_PRESS_MS);
    if (ripple) {
      setRipple(null);
      return;
    }
    const mask = e.currentTarget as HTMLElement;
    const diameter = Math.max(mask.clientWidth, mask.clientHeight);
    const touch = e.touches[0];
    const maskRect = mask.getBoundingClientRect();
    setRipple({
      diameter,
      left: touch.clientX - maskRect.left - diameter / 2,
      top: touch.clientY - maskRect.top - diameter / 2,
    });
  };
  const handleTouchEnd = (e: TouchEvent): void => {
    setRipple(null);
    clearTimeout(timerRef.current);
    if (!hasLongPressedRef.current) return;

    // A long press opens the bottom sheet in the narrow layout and acts as a tap in
    // the wide one. Whether the browser still sends a click after a long press
    // differs between browsers, so the row handles the press itself and cancels that
    // click.
    e.preventDefault();
    if (!isNarrowLayout) openEditor();
  };

  // A touch that moves is a scroll, even after the long press time has passed.
  const handleTouchMove = (): void => {
    clearTimeout(timerRef.current);
    hasLongPressedRef.current = false;
  };

  let activeModal: ReactNode = null;
  if (activeModalName === "edit") {
    activeModal = editModal ? editModal(hideModal) : null;
  } else if (activeModalName === "checkDelete") {
    activeModal = deleteModal ? deleteModal(hideModal) : null;
  }

  return (
    <>
      {activeModal}
      <div
        data-scroll-anchor={editPath}
        className={`${styles.main} ${isBottomSheetOpen ? styles.active : ""}`}
      >
        <button
          type="button"
          className={styles.mask}
          aria-labelledby={contentId}
          onClick={openEditor}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          {ripple && (
            <span
              className={styles.ripple}
              style={{
                width: `${ripple.diameter}px`,
                height: `${ripple.diameter}px`,
                left: `${ripple.left}px`,
                top: `${ripple.top}px`,
              }}
            />
          )}
        </button>
        <span id={contentId} className={styles.content}>
          {children}
        </span>
        <span className={styles.action_bar_outer}>
          <ListRowActionBar onClickDelete={handleClickDelete} />
        </span>
        {isBottomSheetOpen && (
          <BottomSheet onClickBackground={() => setIsBottomSheetOpen(false)}>
            {(closeBottomSheet) => (
              <ListRowActionBar
                forMobile
                onClickEdit={() => closeBottomSheet(openEditor)}
                onClickDelete={() => closeBottomSheet(handleClickDelete)}
              />
            )}
          </BottomSheet>
        )}
      </div>
    </>
  );
}
