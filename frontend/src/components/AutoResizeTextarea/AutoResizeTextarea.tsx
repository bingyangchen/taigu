import React, { ChangeEventHandler } from "react";

import styles from "./AutoResizeTextarea.module.scss";

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
  private resizeTextarea(): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "32px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  public componentDidMount(): void {
    this.resizeTextarea();
    if (this.props.autoFocus) {
      const input = this.textareaRef.current;
      if (!input) return;

      input.setSelectionRange(input.value.length, input.value.length);
      input.focus();
    }
  }
  public componentDidUpdate(): void {
    this.resizeTextarea();
  }
  public render(): React.ReactNode {
    return (
      <textarea
        className={styles.main}
        value={this.props.value}
        onChange={this.props.onChange ?? (() => {})}
        placeholder={this.props.placeholder}
        ref={this.textareaRef}
      />
    );
  }
}
