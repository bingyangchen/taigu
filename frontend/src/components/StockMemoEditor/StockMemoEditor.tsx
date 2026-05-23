import React, { ChangeEvent, MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { AutoResizeTextarea, BottomSheet, Button, Modal } from "../../components";
import { updateOrCreateMemo } from "../../redux/slices/MemoSlice";
import { pushToast } from "../../redux/slices/ToastSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import Util from "../../utils/util";
import styles from "./StockMemoEditor.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.memo;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  sid: string;
  defaultValue: string;
  hideModal: MouseEventHandler;
  dispatch: AppDispatch;
}

interface State {
  sid: string;
  value: string;
}

class StockMemoEditor extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { sid: props.sid, value: props.defaultValue };
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    if (Util.isMobile) {
      return (
        <BottomSheet onClickBackground={this.props.hideModal} canMaximize>
          <div className={styles.sheet_content}>
            <div className={styles.sheet_header}>
              <h2>備註</h2>
            </div>
            <div className={styles.sheet_body}>{this.memoTextarea}</div>
            <div className={styles.sheet_footer}>
              <Button className="transparent l" onClick={this.props.hideModal}>
                捨棄
              </Button>
              <Button
                className="primary_fill l"
                disabled={!this.canSubmit}
                waiting={this.props.isWaiting}
                onClick={this.handleClickSubmit}
              >
                {this.props.defaultValue ? "送出" : "新增備註"}
              </Button>
            </div>
          </div>
        </BottomSheet>
      );
    }

    return (
      <Modal
        title="備註"
        discardButtonProps={{
          children: "捨棄",
          className: "transparent l",
          onClick: this.props.hideModal,
        }}
        submitButtonProps={{
          children: this.props.defaultValue ? "送出" : "新增備註",
          className: "primary l",
          disabled: !this.canSubmit,
          waiting: this.props.isWaiting,
          onClick: this.handleClickSubmit,
        }}
        layout="compact"
        noX
        silentBackground
      >
        {this.memoTextarea}
      </Modal>
    );
  }
  private get memoTextarea(): React.ReactNode {
    return (
      <AutoResizeTextarea
        value={this.state.value}
        onChange={this.handleValueChange}
        placeholder="還沒有備註，可以記下你的觀察或交易想法。"
        autoFocus
      />
    );
  }
  private get canSubmit(): boolean {
    return !this.props.isWaiting;
  }
  private handleValueChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    this.setState({ value: e.target.value });
  };
  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!this.canSubmit) return;
    await this.props
      .dispatch(
        updateOrCreateMemo({ sid: this.state.sid, note: this.state.value.trim() }),
      )
      .unwrap();
    this.props.dispatch(pushToast({ type: "success", text: "備註已更新" }));
    this.props.hideModal(e);
  };
}

export default connect(mapStateToProps)(StockMemoEditor);
