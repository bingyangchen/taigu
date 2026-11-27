import React, { memo, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import { RoundButton } from "../../components";
import * as Icons from "../../icons";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { removeToast } from "../../redux/slices/ToastSlice";
import type { ToastMessage } from "../../types";
import styles from "./ToastList.module.scss";

const TOAST_LIFETIME_MS = 5000;

function Toast({
  toast,
  onRemoved,
}: {
  toast: ToastMessage;
  onRemoved: () => void;
}): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const remainingMsRef = useRef(TOAST_LIFETIME_MS);
  const isPaused = isHovered || isFocused;

  useEffect(() => {
    if (isPaused || isLeaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => setIsLeaving(true), remainingMsRef.current);
    return () => {
      clearTimeout(timer);
      remainingMsRef.current -= Date.now() - startedAt;
    };
  }, [isPaused, isLeaving]);

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]} ${isLeaving ? styles.leaving : ""}`}
      role={toast.type === "error" ? "alert" : "status"}
      // A tap on a touch screen also sends a pointer "enter", with no "leave" until
      // the next tap elsewhere, which would keep the toast open.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setIsHovered(true);
      }}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
      onAnimationEnd={(event) => {
        if (isLeaving && event.target === event.currentTarget) onRemoved();
      }}
    >
      <span className={styles.mark} aria-hidden="true">
        {toast.type === "success" && <Icons.IconCheck sideLength="16" />}
        {toast.type === "warning" && <Icons.IconInfoCircle sideLength="14" />}
        {toast.type === "error" && <Icons.IconExclamation sideLength="14" />}
      </span>
      <p className={styles.text}>{toast.text}</p>
      <RoundButton
        className={styles.close_button}
        size="l"
        hint_text="關閉通知"
        onClick={() => setIsLeaving(true)}
      >
        <Icons.IconXLarge sideLength="12" />
      </RoundButton>
      <span
        className={`${styles.timer} ${isPaused ? styles.paused : ""}`}
        style={{ animationDuration: `${TOAST_LIFETIME_MS}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}

function ToastList() {
  const toasts = useAppSelector((state) => state.toast.toasts);
  const dispatch = useAppDispatch();
  const [toastRoot] = useState(() => {
    const element = document.getElementById("toast-root");
    if (!element) {
      throw new Error("Missing #toast-root element");
    }
    return element;
  });

  return ReactDOM.createPortal(
    // A Radix dialog hides everything outside it from assistive technology except
    // elements with `aria-live`. "off" keeps the toasts reachable without making the
    // list a live region of its own, since each toast announces itself by its role.
    <div className={styles.main} aria-live="off">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemoved={() => dispatch(removeToast(toast.id))}
        />
      ))}
    </div>,
    toastRoot,
  );
}

export default memo(ToastList);
