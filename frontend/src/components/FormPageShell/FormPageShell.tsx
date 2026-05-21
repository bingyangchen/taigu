import React from "react";

import { Button } from "../../components";
import type { Props as ButtonProps } from "../Button/Button";
import styles from "./FormPageShell.module.scss";

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
  submitButtonProps?: ButtonProps;
  discardButtonProps?: ButtonProps;
}

export default class FormPageShell extends React.Component<Props> {
  public render(): React.ReactNode {
    return (
      <section className={styles.main}>
        <header className={styles.header}>
          <h1>{this.props.title}</h1>
        </header>
        <div className={styles.body}>{this.props.children}</div>
        <footer className={styles.footer}>
          {this.props.discardButtonProps && (
            <Button
              className={this.props.discardButtonProps.className}
              disabled={this.props.discardButtonProps.disabled}
              waiting={this.props.discardButtonProps.waiting}
              canTriggerByEnter={this.props.discardButtonProps.canTriggerByEnter}
              onClick={this.props.discardButtonProps.onClick}
            >
              {this.props.discardButtonProps.children}
            </Button>
          )}
          {this.props.submitButtonProps && (
            <Button
              className={this.props.submitButtonProps.className}
              disabled={this.props.submitButtonProps.disabled}
              waiting={this.props.submitButtonProps.waiting}
              canTriggerByEnter={this.props.submitButtonProps.canTriggerByEnter}
              onClick={this.props.submitButtonProps.onClick}
            >
              {this.props.submitButtonProps.children}
            </Button>
          )}
        </footer>
      </section>
    );
  }
}
