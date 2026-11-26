import React, { ChangeEvent, useId, useLayoutEffect, useRef, useState } from "react";

import { RoundButton } from "../../components";
import * as Icons from "../../icons";
import styles from "./LabeledInputV2.module.scss";

type InputType = "number" | "text" | "password" | "email" | "date" | "hidden";

interface Props {
  title: string;
  type?: InputType;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  autocomplete?: string;
  value: string;
  onChange?: React.Dispatch<string>;
  autoFocus?: boolean;
}

export default function LabeledInputV2({
  title,
  type,
  inputMode,
  autocomplete,
  value,
  onChange,
  autoFocus,
}: Props) {
  const [shownType, setShownType] = useState<InputType>(type ?? "text");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useLayoutEffect(() => {
    if (!autoFocus) return;
    const input = inputRef.current;
    if (!input) return;
    if (["text", "password", "email"].includes(input.type)) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
    input.focus();
  }, [autoFocus]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };
  const handlePasswordPeekability = () => {
    setShownType((current) => (current === "password" ? "text" : "password"));
  };

  return (
    <div className={styles.main}>
      <label className={styles.label} htmlFor={inputId}>
        {title}
      </label>
      <div className={styles.inputWrapper}>
        <input
          id={inputId}
          ref={inputRef}
          type={shownType}
          inputMode={inputMode}
          value={value}
          onChange={handleInputChange}
          autoComplete={autocomplete ?? "off"}
          className={styles.input}
        />
        {type === "password" && (
          <RoundButton
            onClick={handlePasswordPeekability}
            hint_text={shownType === "password" ? "顯示密碼" : "隱藏密碼"}
          >
            {shownType === "password" ? (
              <Icons.IconEyeSlash sideLength="20" />
            ) : (
              <Icons.IconEye sideLength="20" />
            )}
          </RoundButton>
        )}
      </div>
    </div>
  );
}
