import styles from "./ToastList.module.scss";

import React from "react";
import ReactDOM from "react-dom";
import { connect } from "react-redux";

import { RoundButton } from "..";
import { IconXLarge } from "../../icons";
import { removeToast } from "../../redux/slices/ToastSlice";
import type { AppDispatch, RootState } from "../../redux/store";

function mapStateToProps(rootState: RootState) {
  const { toasts } = rootState.toast;
  return { toasts };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {}

class ToastList extends React.Component<Props, State> {
  public state: State;
  private toastRoot: HTMLElement;
  public constructor(props: Props) {
    super(props);
    this.state = {};
    this.toastRoot = document.getElementById("toast-root")!;
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return ReactDOM.createPortal(
      <div className={styles.main}>
        {this.props.toasts.map((each, idx) => {
          return (
            <div key={idx} className={styles.toast_outer}>
              <div className={`${styles.toast} ${styles[each.type]}`}>
                {each.text}
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
      this.toastRoot
    );
  }
  private handleClickRemoveMessage = (idx: number): void => {
    this.props.dispatch(removeToast(idx));
  };
}

export default connect(mapStateToProps)(ToastList);
