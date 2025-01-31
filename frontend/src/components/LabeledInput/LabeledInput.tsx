import styles from "./LabeledInput.module.scss";

import React, { ChangeEvent, FocusEvent } from "react";

import { RoundButton } from "..";
import { IconEye, IconEyeSlash } from "../../icons";

interface Props {
    title: string;
    type?: "number" | "text" | "password" | "email" | "date" | "hidden";
    autocomplete?: string;
    value: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
    autoFocus?: boolean;
}

interface State {
    isInputFocused: boolean;
    type: "number" | "text" | "password" | "email" | "date" | "hidden";
}

export default class LabeledInput extends React.Component<Props, State> {
    public state: State;
    private inputRef: React.RefObject<HTMLInputElement>;
    public constructor(props: Props) {
        super(props);
        this.state = {
            isInputFocused: false,
            type: props.type || "text",
        };
        this.inputRef = React.createRef();
    }
    public componentDidMount(): void {
        this.autoFocusIfNeeded();
    }
    public render(): React.ReactNode {
        return (
            <fieldset
                className={`${styles.main} ${
                    this.state.isInputFocused ? styles.focused : ""
                }`}
                disabled={this.props.disabled || false}
            >
                <legend
                    className={this.state.isInputFocused ? styles.focused : ""}
                >
                    {this.props.title}
                </legend>
                <input
                    ref={this.inputRef}
                    type={this.state.type}
                    disabled={this.props.disabled || false}
                    value={this.props.value}
                    onChange={this.handleInputChange}
                    autoComplete={this.props.autocomplete || "off"}
                    role="presentation"
                    onFocus={this.handleFocusInput}
                    onBlur={this.handleUnfocusInput}
                />
                {this.props.type === "password" && (
                    <RoundButton
                        onClick={this.handlePasswordPeekability}
                        hint_text={
                            this.state.type === "password"
                                ? "顯示密碼"
                                : "隱藏密碼"
                        }
                    >
                        {this.state.type === "password" ? (
                            <IconEyeSlash sideLength="20" />
                        ) : (
                            <IconEye sideLength="20" />
                        )}
                    </RoundButton>
                )}
            </fieldset>
        );
    }
    private autoFocusIfNeeded(): void {
        if (!this.props.autoFocus) return;
        this.setState({ isInputFocused: true });
        const input = this.inputRef.current!;
        if (["text", "password", "email"].includes(this.state.type)) {
            input.setSelectionRange(input.value.length, input.value.length);
        }
        input.focus();
    }
    private handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        this.props.onChange?.(e.target.value);
    };
    private handleFocusInput = (e: FocusEvent) => {
        this.setState({ isInputFocused: true });
    };
    private handleUnfocusInput = (e: FocusEvent) => {
        this.setState({ isInputFocused: false });
    };
    private handlePasswordPeekability = () => {
        this.setState((state, props) => {
            return { type: state.type === "password" ? "text" : "password" };
        });
    };
}
