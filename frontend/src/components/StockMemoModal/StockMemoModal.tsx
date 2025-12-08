import React, { ChangeEvent, MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { AutoResizeTextarea, Modal } from "../../components";
import { updateOrCreateMemo } from "../../redux/slices/MemoSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import Util from "../../utils/util";

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

class StockMemoModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { sid: props.sid, value: props.defaultValue };
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <Modal
        title="備註"
        discardButtonProps={{
          children: "捨棄",
          className: "transparent l",
          onClick: this.props.hideModal,
        }}
        submitButtonProps={{
          children: "送出",
          className: "primary l",
          disabled: !this.canSubmit,
          waiting: this.props.isWaiting,
          onClick: this.handleClickSubmit,
        }}
        layout={Util.isMobile ? "fullScreen" : "compact"}
        noX
        silentBackground
      >
        <AutoResizeTextarea
          value={this.state.value}
          onChange={this.handleValueChange}
          autoFocus
        />
      </Modal>
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
    this.props.hideModal(e);
  };
}

export default connect(mapStateToProps)(StockMemoModal);
