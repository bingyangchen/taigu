import "./Button.scss";

import { Slot } from "@radix-ui/react-slot";
import React from "react";

export interface Props
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  children: React.ReactNode;
  className?: string;
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
      children,
      className = "",
      disabled = false,
      onClick,
      waiting = false,
      ...buttonProps
    } = this.props;
    void canTriggerByEnter;
    const isDisabled = disabled || waiting;
    const classNames = `button ${className} ${waiting ? "waiting" : ""}`;
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
      <button
        {...buttonProps}
        aria-busy={waiting || undefined}
        className={classNames}
        data-waiting={waiting ? "" : undefined}
        disabled={isDisabled}
        onClick={handleClick}
      >
        <span className="button__content">{children}</span>
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
      } catch (error) {
        return;
      }
    }
  };
}
