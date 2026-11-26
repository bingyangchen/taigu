import { ChangeEventHandler, useLayoutEffect, useRef } from "react";

import styles from "./AutoResizeTextarea.module.scss";

interface Props {
  value: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange?: ChangeEventHandler;
}

export default function AutoResizeTextarea({
  value,
  placeholder,
  autoFocus,
  onChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "32px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  });

  useLayoutEffect(() => {
    if (!autoFocus) return;
    const input = textareaRef.current;
    if (!input) return;

    input.setSelectionRange(input.value.length, input.value.length);
    input.focus();
  }, [autoFocus]);

  return (
    <textarea
      className={styles.main}
      value={value}
      onChange={onChange ?? (() => {})}
      placeholder={placeholder}
      ref={textareaRef}
    />
  );
}
