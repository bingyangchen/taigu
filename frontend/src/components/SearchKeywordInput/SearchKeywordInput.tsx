import { ChangeEvent, InputHTMLAttributes, useLayoutEffect, useRef } from "react";

import * as Icons from "../../icons";
import RoundButton from "../RoundButton/RoundButton";
import styles from "./SearchKeywordInput.module.scss";

type InputAttributes = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | "role"
  | "aria-autocomplete"
  | "aria-controls"
  | "aria-expanded"
  | "aria-activedescendant"
  | "onKeyDown"
>;

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
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className={`${styles.main} ${size === "l" ? styles.l : styles.m}`}>
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
