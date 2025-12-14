import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { LabeledInput, Modal } from "../../components";
import {
  createDiscount,
  updateDiscount,
} from "../../redux/slices/HandlingFeeDiscountSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { HandlingFeeDiscount } from "../../types";
import Util from "../../utils/util";
import styles from "./HandlingFeeDiscountModal.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.handlingFeeDiscount;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  record?: HandlingFeeDiscount;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  dispatch: AppDispatch;
}

interface State {
  recordId: number | null;
  date: string;
  amount: number;
  memo: string;
}

class HandlingFeeDiscountModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      recordId: props.record?.id ?? null,
      date: props.record?.date ?? new Date().toLocaleDateString("af"),
      amount: props.record ? props.record.amount : NaN,
      memo: props.record?.memo ?? "",
    };
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <Modal
        title={`${this.props.record ? "編輯" : "新增"}折讓紀錄`}
        discardButtonProps={{
          children: "捨棄",
          className: "transparent l",
          onClick: this.props.hideModal,
        }}
        submitButtonProps={{
          children: "送出",
          className: "primary_fill l",
          disabled: !this.canSubmit,
          waiting: this.props.isWaiting,
          onClick: this.handleClickSubmit,
          canTriggerByEnter: true,
        }}
        layout={Util.isMobile ? "fullScreen" : "compact"}
        noX
        silentBackground
      >
        <div className={styles.modal_inner}>
          <LabeledInput
            title="日期"
            type="date"
            value={this.state.date}
            onChange={(date: string) => this.setState({ date: date })}
          />
          <LabeledInput
            title="折讓金額"
            type="number"
            inputMode="numeric"
            value={
              this.state.amount || this.state.amount === 0
                ? this.state.amount.toString()
                : ""
            }
            onChange={this.handleAmountChange}
            autoFocus={Boolean(this.state.date)}
          />
          <LabeledInput
            title="備註"
            type="text"
            value={this.state.memo}
            onChange={(memo: string) => this.setState({ memo: memo })}
          />
        </div>
      </Modal>
    );
  }
  private get canSubmit(): boolean {
    return Boolean(
      this.state.date && !Object.is(this.state.amount, NaN) && !this.props.isWaiting,
    );
  }
  private handleAmountChange = (amount: string): void => {
    this.setState({
      amount: amount === "" ? NaN : parseInt(amount) < 0 ? 0 : parseInt(amount),
    });
  };
  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!this.canSubmit) throw Error("Cannot submit!");
    try {
      if (this.state.recordId) {
        // Update
        await this.props
          .dispatch(
            updateDiscount({
              id: this.state.recordId,
              date: this.state.date,
              amount: this.state.amount,
              memo: this.state.memo || undefined,
            }),
          )
          .unwrap();
      } else {
        // Create
        await this.props
          .dispatch(
            createDiscount({
              date: this.state.date,
              amount: this.state.amount,
              memo: this.state.memo || undefined,
            }),
          )
          .unwrap();
      }
      this.props.hideModal(e);
      this.props.onSave?.();
    } catch (reason) {
      this.props.hideModal(e);
    }
  };
}

export default connect(mapStateToProps)(HandlingFeeDiscountModal);
