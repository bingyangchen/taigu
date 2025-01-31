import styles from "./AutoResizeTextarea.module.scss";

import React, { ChangeEventHandler } from "react";

interface Props {
    value: string;
    placeholder?: string;
    autoFocus?: boolean;
    onChange?: ChangeEventHandler;
}

interface State {}

export default class AutoResizeTextarea extends React.Component<Props, State> {
    public state: State;
    private textareaRef: React.RefObject<HTMLTextAreaElement>;
    public constructor(props: Props) {
        super(props);
        this.state = {};
        this.textareaRef = React.createRef();
    }
    public componentDidMount(): void {
        this.textareaRef.current!.style.height = "32px";
        this.textareaRef.current!.style.height =
            this.textareaRef.current!.scrollHeight + "px";
        if (this.props.autoFocus) {
            const input = this.textareaRef.current!;
            input.setSelectionRange(input.value.length, input.value.length);
            input.focus();
        }
    }
    public componentDidUpdate(): void {
        this.textareaRef.current!.style.height = "32px";
        this.textareaRef.current!.style.height =
            this.textareaRef.current!.scrollHeight + "px";
    }
    public render(): React.ReactNode {
        return (
            <textarea
                className={styles.main}
                value={this.props.value}
                onChange={this.props.onChange || (() => {})}
                placeholder={this.props.placeholder}
                ref={this.textareaRef}
            />
        );
    }
}
