import { ChangeEvent, useLayoutEffect, useRef } from "react";

import * as Icons from "../../icons";
import styles from "./SearchKeywordInput.module.scss";

interface Props {
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
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange?.(e.target.value);
  };

  return (
    <div className={`${styles.main} ${size === "l" ? styles.l : styles.m}`}>
      <Icons.IconMagnifier sideLength={size === "l" ? "18" : "14"} />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={keyword || ""}
        onChange={handleInputChange}
      />
    </div>
  );
}
