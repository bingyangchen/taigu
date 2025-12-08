import React, { ChangeEvent } from "react";

import { IconMagnifier } from "../../icons";
import styles from "./SearchKeywordInput.module.scss";

interface Props {
  placeholder: string;
  keyword: string;
  autoFocus?: boolean;
  size?: "m" | "l";
  onChange?: (value: string) => void;
}

interface State {}

export default class SearchKeywordInput extends React.Component<Props, State> {
  public state: State;
  private inputRef: React.RefObject<HTMLInputElement>;
  public constructor(props: Props) {
    super(props);
    this.state = {};
    this.inputRef = React.createRef();
  }
  public componentDidMount(): void {
    this.autoFocusIfNeeded();
  }
  public render(): React.ReactNode {
    return (
      <div
        className={`${styles.main} ${this.props.size === "l" ? styles.l : styles.m}`}
      >
        <IconMagnifier sideLength={this.props.size === "l" ? "18" : "14"} />
        <input
          ref={this.inputRef}
          type="text"
          placeholder={this.props.placeholder}
          value={this.props.keyword || ""}
          onChange={this.handleInputChange}
        />
      </div>
    );
  }
  private autoFocusIfNeeded(): void {
    if (this.props.autoFocus) this.inputRef.current?.focus();
  }
  private handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.props.onChange?.(e.target.value);
  };
}
