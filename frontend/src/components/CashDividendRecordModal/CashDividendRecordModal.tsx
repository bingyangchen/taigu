import styles from "./CashDividendRecordModal.module.scss";

import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { LabeledInput, Modal } from "..";
import { createRecord, updateRecord } from "../../redux/slices/CashDividendRecordSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { CashDividendRecord } from "../../types";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.cashDividend;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  defaultSid?: string;
  record?: CashDividendRecord;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  dispatch: AppDispatch;
}

interface State {
  recordId: string | null;
  dealTime: string;
  sid: string;
  cashDividend: number;
}

class CashDividendRecordModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      recordId: props.record?.id.toString() || null,
      dealTime: props.record?.deal_time || new Date().toLocaleDateString("af"),
      sid: props.defaultSid || props.record?.sid || "",
      cashDividend: props.record ? props.record.cash_dividend : NaN,
    };
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <Modal
        title={`${this.props.record ? "編輯" : "新增"}現金股利`}
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
        }}
        layout={Util.isMobile ? "fullScreen" : "compact"}
        noX
        silentBackground
      >
        <div className={styles.modal_inner}>
          <LabeledInput
            title="交易日期"
            type="date"
            value={this.state.dealTime}
            onChange={(dealTime: string) => this.setState({ dealTime: dealTime })}
          />
          <LabeledInput
            title="證券代號"
            value={this.state.sid}
            onChange={(sid: string) => this.setState({ sid: sid })}
            autoFocus={!Boolean(this.state.sid)}
          />
          <LabeledInput
            title="現金股利"
            type="number"
            value={
              this.state.cashDividend || this.state.cashDividend === 0
                ? this.state.cashDividend.toString()
                : ""
            }
            onChange={(cashDividend: string) => {
              this.setState({
                cashDividend: cashDividend === "" ? NaN : parseInt(cashDividend),
              });
            }}
            autoFocus={Boolean(this.state.sid)}
          />
        </div>
      </Modal>
    );
  }
  private get canSubmit(): boolean {
    return Boolean(
      this.state.dealTime &&
        this.state.sid &&
        !Object.is(this.state.cashDividend, NaN) &&
        !this.props.isWaiting,
    );
  }
  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!this.canSubmit) throw Error("Cannot submit!");
    try {
      if (this.state.recordId) {
        // Update
        await this.props
          .dispatch(
            updateRecord({
              id: this.state.recordId!,
              sid: this.state.sid,
              deal_time: this.state.dealTime,
              cash_dividend: this.state.cashDividend,
            }),
          )
          .unwrap();
      } else {
        // Create
        await this.props
          .dispatch(
            createRecord({
              sid: this.state.sid,
              deal_time: this.state.dealTime,
              cash_dividend: this.state.cashDividend,
            }),
          )
          .unwrap();
      }
      this.props.hideModal(e);
      this.props.onSave?.();
    } catch (reason: any) {
      this.props.hideModal(e);
    }
  };
}

export default connect(mapStateToProps)(CashDividendRecordModal);
