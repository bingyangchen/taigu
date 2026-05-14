import React, { ChangeEvent } from "react";

import { RoundButton } from "../../components";
import { IconEye, IconEyeSlash } from "../../icons";
import styles from "./LabeledInputV2.module.scss";

interface Props {
  title: string;
  type?: "number" | "text" | "password" | "email" | "date" | "hidden";
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
}

interface State {
  isInputFocused: boolean;
  type: "number" | "text" | "password" | "email" | "date" | "hidden";
}

let labeledInputV2Id = 0;

export default class LabeledInputV2 extends React.Component<Props, State> {
  public state: State;
  private inputRef: React.RefObject<HTMLInputElement>;
  private readonly inputId: string;
  public constructor(props: Props) {
    super(props);
    this.state = { isInputFocused: false, type: props.type ?? "text" };
    this.inputRef = React.createRef();
    labeledInputV2Id += 1;
    this.inputId = `labeled-input-v2-${labeledInputV2Id}`;
  }
  public componentDidMount(): void {
    this.autoFocusIfNeeded();
  }
  public render(): React.ReactNode {
    return (
      <div className={`${styles.main} ${this.props.disabled ? styles.disabled : ""}`}>
        <label className={styles.label} htmlFor={this.inputId}>
          {this.props.title}
        </label>
        <div className={styles.inputWrapper}>
          <input
            id={this.inputId}
            ref={this.inputRef}
            type={this.state.type}
            inputMode={this.props.inputMode}
            disabled={this.props.disabled ?? false}
            value={this.props.value}
            onChange={this.handleInputChange}
            autoComplete={this.props.autocomplete ?? "off"}
            onFocus={this.handleFocusInput}
            onBlur={this.handleUnfocusInput}
            className={styles.input}
          />
          {this.props.type === "password" && (
            <RoundButton
              onClick={this.handlePasswordPeekability}
              hint_text={this.state.type === "password" ? "顯示密碼" : "隱藏密碼"}
            >
              {this.state.type === "password" ? (
                <IconEyeSlash sideLength="20" />
              ) : (
                <IconEye sideLength="20" />
              )}
            </RoundButton>
          )}
        </div>
      </div>
    );
  }
  private autoFocusIfNeeded(): void {
    if (!this.props.autoFocus) return;
    this.setState({ isInputFocused: true });
    const input = this.inputRef.current;
    if (!input) return;
    if (["text", "password", "email"].includes(this.state.type)) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
    input.focus();
  }
  private handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange?.(e.target.value);
  };
  private handleFocusInput = () => {
    this.setState({ isInputFocused: true });
  };
  private handleUnfocusInput = () => {
    this.setState({ isInputFocused: false });
  };
  private handlePasswordPeekability = () => {
    this.setState((state) => {
      return { type: state.type === "password" ? "text" : "password" };
    });
  };
}
