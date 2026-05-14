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
    const Component = asChild ? Slot : "button";

    return (
      <Component
        {...buttonProps}
        aria-busy={waiting || undefined}
        className={`button ${className} ${waiting ? "waiting" : ""}`}
        data-waiting={waiting ? "" : undefined}
        disabled={disabled || waiting}
        onClick={onClick}
      >
        <span className="button__content">{children}</span>
      </Component>
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
