import {
  ChangeEvent,
  InputHTMLAttributes,
  RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import * as Icons from "../../icons";
import RoundButton from "../RoundButton/RoundButton";
import styles from "./SearchKeywordInput.module.scss";

type InputAttributes = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | "role"
  | "aria-label"
  | "aria-autocomplete"
  | "aria-controls"
  | "aria-expanded"
  | "aria-activedescendant"
  | "onKeyDown"
>;

// A finger moving less than this is a tap, not a scroll.
const DRAG_MIN_DISTANCE = 10;

// iOS moves the caret when the finger is held this long on a field before moving.
const LONG_PRESS_MIN_DURATION = 500;

/**
 * Closes the on-screen keyboard once the user drags the page, the way a native list
 * does. Otherwise a phone keeps the keyboard up while the page scrolls under it, and
 * the fixed footer and speed dial ride up on top of the keyboard. A drag that starts
 * on the clear button, or after a long press on the field, which moves the caret, is
 * left alone.
 */
function useDismissKeyboardOnDrag(
  fieldRef: RefObject<HTMLElement | null>,
  inputRef: RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let drag: { startY: number; startTime: number; isOnInput: boolean } | null = null;

    const handleTouchStart = (event: TouchEvent): void => {
      const target = event.target as Node;
      const touch = event.touches[0];
      const isOnInput = input.contains(target);
      const isOnOtherFieldPart =
        !isOnInput && Boolean(fieldRef.current?.contains(target));
      drag =
        touch && !isOnOtherFieldPart
          ? { startY: touch.clientY, startTime: Date.now(), isOnInput }
          : null;
    };
    const handleTouchMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (
        !drag ||
        !touch ||
        Math.abs(touch.clientY - drag.startY) < DRAG_MIN_DISTANCE
      ) {
        return;
      }
      const isMovingCaret =
        drag.isOnInput && Date.now() - drag.startTime >= LONG_PRESS_MIN_DURATION;
      drag = null;
      if (!isMovingCaret) input.blur();
    };

    // Listens only while the field has the focus, so the fields that are not being
    // typed in do not handle every touch on the page.
    const startListening = (): void => {
      document.addEventListener("touchstart", handleTouchStart, { passive: true });
      document.addEventListener("touchmove", handleTouchMove, { passive: true });
    };
    const stopListening = (): void => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      drag = null;
    };
    input.addEventListener("focus", startListening);
    input.addEventListener("blur", stopListening);
    if (document.activeElement === input) startListening();
    return () => {
      input.removeEventListener("focus", startListening);
      input.removeEventListener("blur", stopListening);
      stopListening();
    };
  }, [fieldRef, inputRef]);
}

interface Props extends InputAttributes {
  placeholder: string;
  keyword: string;
  autoFocus?: boolean;
  size?: "m" | "l";
  onChange?: (_value: string) => void;
}

export default function SearchKeywordInput({
  placeholder,
  keyword,
  autoFocus,
  size,
  onChange,
  ...inputAttributes
}: Props) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDismissKeyboardOnDrag(fieldRef, inputRef);

  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange?.(e.target.value);
  };

  const clearKeyword = (): void => {
    onChange?.("");
    inputRef.current?.focus();
  };

  return (
    <div
      ref={fieldRef}
      className={`${styles.main} ${size === "l" ? styles.l : styles.m}`}
    >
      <Icons.IconMagnifier sideLength={size === "l" ? "18" : "14"} />
      <input
        {...inputAttributes}
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={keyword || ""}
        onChange={handleInputChange}
      />
      {keyword && (
        <RoundButton
          className={styles.clear_button}
          hint_text="清除搜尋"
          // Keeps the focus in the input, so a phone's keyboard does not close and
          // reopen when the user taps the button.
          onMouseDown={(event) => event.preventDefault()}
          onClick={clearKeyword}
        >
          <Icons.IconXLarge sideLength="12" />
        </RoundButton>
      )}
    </div>
  );
}
