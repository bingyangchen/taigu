import styles from "./ErrorList.module.scss";

import React from "react";
import ReactDOM from "react-dom";
import { connect } from "react-redux";

import { RoundButton } from "..";
import { IconXLarge } from "../../icons";
import { removeError } from "../../redux/slices/ErrorSlice";
import type { AppDispatch, RootState } from "../../redux/store";

function mapStateToProps(rootState: RootState) {
  const { errors } = rootState.error;
  return { errors };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {}

class ErrorList extends React.Component<Props, State> {
  public state: State;
  private errorRoot: HTMLElement;
  public constructor(props: Props) {
    super(props);
    this.state = {};
    this.errorRoot = document.getElementById("error-root")!;
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return ReactDOM.createPortal(
      <div className={styles.main}>
        {this.props.errors.map((each, idx) => {
          return (
            <div key={idx} className={styles.toast_outer}>
              <div className={styles.toast}>
                {each.message}
                <RoundButton
                  onClick={() => this.handleClickRemoveMessage(idx)}
                  className={styles.close_button}
                >
                  <IconXLarge sideLength="8" color="#FFF" />
                </RoundButton>
              </div>
            </div>
          );
        })}
      </div>,
      this.errorRoot
    );
  }
  private handleClickRemoveMessage = (idx: number): void => {
    this.props.dispatch(removeError(idx));
  };
}

export default connect(mapStateToProps)(ErrorList);
