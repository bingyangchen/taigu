import React, { ChangeEvent, useId, useLayoutEffect, useState } from "react";

import { RoundButton } from "../../components";
import * as Icons from "../../icons";
import styles from "./LabeledInput.module.scss";

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
  disabled?: boolean;
  onChange?: React.Dispatch<string>;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  suffix?: React.ReactNode;
  invalid?: boolean;
  describedBy?: string;
  max?: string;
}

export default function LabeledInput({
  title,
  type,
  inputMode,
  autocomplete,
  value,
  disabled,
  onChange,
  autoFocus,
  inputRef,
  suffix,
  invalid,
  describedBy,
  max,
}: Props) {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [shownType, setShownType] = useState<InputType>(type ?? "text");
  const [resolvedInputRef] = useState(
    () => inputRef ?? React.createRef<HTMLInputElement>(),
  );
  const inputId = useId();

  useLayoutEffect(() => {
    if (!autoFocus) return;
    setIsInputFocused(true);
    const input = resolvedInputRef.current;
    if (!input) return;
    if (["text", "password", "email"].includes(input.type)) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
    input.focus();
  }, [autoFocus, resolvedInputRef]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };
  const handlePasswordPeekability = () => {
    setShownType((current) => (current === "password" ? "text" : "password"));
  };

  return (
    <fieldset
      className={`${styles.main} ${isInputFocused ? styles.focused : ""} ${
        invalid ? styles.invalid : ""
      }`}
      disabled={disabled ?? false}
    >
      <legend className={isInputFocused ? styles.focused : ""}>{title}</legend>
      <input
        id={inputId}
        ref={resolvedInputRef}
        aria-label={title}
        type={shownType}
        inputMode={inputMode}
        disabled={disabled ?? false}
        value={value}
        onChange={handleInputChange}
        autoComplete={autocomplete ?? "off"}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        max={max}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
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
    </fieldset>
  );
}
