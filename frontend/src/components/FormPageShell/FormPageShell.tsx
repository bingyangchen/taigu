import React, { useState } from "react";

import { Button, RoundButton } from "../../components";
import * as Icons from "../../icons";
import type { Props as ButtonProps } from "../Button/Button";
import DiscardChangesModal from "../DiscardChangesModal/DiscardChangesModal";
import styles from "./FormPageShell.module.scss";

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
  submitButtonProps?: ButtonProps;
  discardButtonProps?: ButtonProps;
  isDirty?: boolean;
  titleRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}

export default function FormPageShell({
  title,
  children,
  submitButtonProps,
  discardButtonProps,
  isDirty,
  titleRef,
  className,
  bodyClassName,
  style,
}: Props) {
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  const handleClickDiscard = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }
    discardButtonProps?.onClick?.(e);
  };

  return (
    <>
      <section className={`${styles.main} ${className ?? ""}`} style={style}>
        <header className={styles.header}>
          <div className={styles.header_action}>
            {discardButtonProps && (
              <RoundButton aria-label="返回" size="l" onClick={handleClickDiscard}>
                <Icons.IconChevronLeft sideLength="16" />
              </RoundButton>
            )}
          </div>
          <h1 ref={titleRef} tabIndex={titleRef ? -1 : undefined}>
            {title}
          </h1>
          <div className={styles.header_action}>
            {submitButtonProps && (
              <Button
                variant="primary"
                size="s"
                className={styles.submit_button}
                disabled={submitButtonProps.disabled}
                waiting={submitButtonProps.waiting}
                canTriggerByEnter={submitButtonProps.canTriggerByEnter}
                onClick={submitButtonProps.onClick}
              >
                {submitButtonProps.children}
              </Button>
            )}
          </div>
        </header>
        <div
          className={`${styles.body} ${bodyClassName ?? ""}`}
          data-page-scroll="always"
        >
          {children}
        </div>
      </section>
      {isConfirmingDiscard && (
        <DiscardChangesModal
          onKeepEditing={() => setIsConfirmingDiscard(false)}
          onDiscard={(e: React.MouseEvent<HTMLButtonElement>) =>
            discardButtonProps?.onClick?.(e)
          }
        />
      )}
    </>
  );
}
