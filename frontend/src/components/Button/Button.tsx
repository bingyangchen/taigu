import { Slot } from "@radix-ui/react-slot";
import React from "react";

import styles from "./Button.module.scss";

export type ButtonVariant =
  | "transparent"
  | "white"
  | "light"
  | "primary_fill"
  | "primary"
  | "dangerous_fill"
  | "dangerous";

// `action` is the submit and cancel row at the bottom of a dialog, an edit page, or a
// form, whose type size follows ui-guidelines.md's table; `l` is the same size for
// other buttons and does not change with the viewport width.
export type ButtonSize = "xs" | "s" | "l" | "action";

export interface Props
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  bordered?: boolean;
  round?: boolean;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  waiting?: boolean;
  canTriggerByEnter?: boolean;
  asChild?: boolean;
}

export default class Button extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
  }
  public componentDidMount(): void {
    window.addEventListener("keydown", this.handleHitEnter);
  }
  public componentWillUnmount(): void {
    window.removeEventListener("keydown", this.handleHitEnter);
  }
  public render(): React.ReactNode {
    const {
      asChild,
      canTriggerByEnter,
      bordered = false,
      children,
      className,
      contentClassName,
      disabled = false,
      onClick,
      round = false,
      size,
      variant,
      waiting = false,
      ...buttonProps
    } = this.props;
    void canTriggerByEnter;
    const isDisabled = disabled || waiting;
    const classNames = [
      styles.main,
      variant && styles[variant],
      size && styles[size],
      bordered && styles.bordered,
      round && styles.round,
      className,
    ]
      .filter(Boolean)
      .join(" ");
    const handleClick: React.MouseEventHandler<HTMLElement> = (e): void => {
      if (isDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement, MouseEvent>);
    };

    if (asChild) {
      return (
        <Slot
          {...buttonProps}
          aria-busy={waiting || undefined}
          aria-disabled={isDisabled || undefined}
          className={classNames}
          data-disabled={isDisabled ? "" : undefined}
          data-waiting={waiting ? "" : undefined}
          onClick={handleClick}
        >
          {children}
        </Slot>
      );
    }

    return (
      // A waiting button stays focusable, even when the caller also passes disabled:
      // a native disabled button would drop focus to <body> while the request is in
      // flight. handleClick blocks the click instead.
      <button
        {...buttonProps}
        aria-busy={waiting || undefined}
        aria-disabled={waiting || undefined}
        className={classNames}
        data-waiting={waiting ? "" : undefined}
        disabled={disabled && !waiting}
        onClick={handleClick}
      >
        <span className={[styles.content, contentClassName].filter(Boolean).join(" ")}>
          {children}
        </span>
      </button>
    );
  }
  private handleHitEnter = (e: KeyboardEvent): void => {
    if (
      this.props.canTriggerByEnter &&
      e.key === "Enter" &&
      !this.props.disabled &&
      !this.props.waiting
    ) {
      try {
        const result = this.props.onClick?.(
          e as unknown as React.MouseEvent<HTMLButtonElement, MouseEvent>,
        );
        if (result && typeof result === "object" && "catch" in result) {
          (result as Promise<unknown>).catch(() => {});
        }
      } catch {
        return;
      }
    }
  };
}
