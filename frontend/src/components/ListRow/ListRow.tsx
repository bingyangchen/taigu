import { MouseEventHandler, ReactNode, TouchEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BottomSheet, ListRowActionBar } from "../../components";
import {
  CashDividendRecord,
  HandlingFeeDiscount,
  TradePlan,
  TradeRecord,
} from "../../types";
import Util from "../../utils/util";
import styles from "./ListRow.module.scss";

interface Props {
  target: TradeRecord | CashDividendRecord | TradePlan | HandlingFeeDiscount;
  children: ReactNode;
  editModal: ((_hideModal: MouseEventHandler) => ReactNode) | null;
  deleteModal: ((_hideModal: MouseEventHandler) => ReactNode) | null;
  editPath?: string;
}

interface Ripple {
  diameter: number;
  left: number;
  top: number;
}

export default function ListRow({ children, editModal, deleteModal, editPath }: Props) {
  const navigate = useNavigate();
  const [activatedForMobile, setActivatedForMobile] = useState(false);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const [activeModalName, setActiveModalName] = useState<"edit" | "checkDelete" | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hideModal = (): void => setActiveModalName(null);
  const handleClickEdit = (): void => {
    if (Util.isMobile && editPath) {
      navigate(editPath);
      return;
    }
    setActiveModalName("edit");
  };
  const handleClickDelete = (): void => setActiveModalName("checkDelete");
  const handleClickBottomSheetBackground = (): void => setActivatedForMobile(false);

  const handleTouchStart = (e: TouchEvent): void => {
    timerRef.current = setTimeout(() => setActivatedForMobile(true), 500);
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
  const handleTouchEnd = (): void => {
    setRipple(null);
    clearTimeout(timerRef.current);
  };
  const handleTouchMove = (): void => {
    clearTimeout(timerRef.current);
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
        className={`${styles.main} ${activatedForMobile ? styles.active : ""}`}
      >
        <span
          className={styles.mask}
          onClick={() => {
            if (Util.isMobile) handleClickEdit();
          }}
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
        </span>
        {children}
        {Util.isMobile ? (
          activatedForMobile && (
            <BottomSheet onClickBackground={handleClickBottomSheetBackground}>
              {(closeBottomSheet) => (
                <ListRowActionBar
                  forMobile
                  onClickEdit={() => closeBottomSheet(handleClickEdit)}
                  onClickDelete={() => closeBottomSheet(handleClickDelete)}
                />
              )}
            </BottomSheet>
          )
        ) : (
          <span className={styles.action_bar_outer}>
            <ListRowActionBar
              onClickEdit={handleClickEdit}
              onClickDelete={handleClickDelete}
            />
          </span>
        )}
      </div>
    </>
  );
}
