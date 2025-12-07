import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { LabeledInput, Modal } from "../../components";
import { fetchSingleStockInfo } from "../../redux/slices/StockInfoSlice";
import { createRecord, updateRecord } from "../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { TradeRecord } from "../../types";
import Util from "../../utils/util";
import styles from "./TradeRecordModal.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.tradeRecord;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  defaultSid?: string;
  record?: TradeRecord;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  dispatch: AppDispatch;
}

interface State {
  recordId: string | null;
  dealTime: string;
  sid: string;
  dealPrice: number;
  isBuying: boolean;
  absDealQuantity: number;
  handlingFee: number;
}

class TradeRecordModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    if (props.record) {
      this.state = {
        recordId: props.record.id.toString(),
        dealTime: props.record.deal_time,
        sid: props.record.sid,
        dealPrice: props.record.deal_price,
        isBuying: props.record.deal_quantity > 0 ? true : false,
        absDealQuantity: Math.abs(props.record.deal_quantity),
        handlingFee: props.record.handling_fee,
      };
    } else {
      this.state = {
        recordId: null,
        dealTime: new Date().toLocaleDateString("af"),
        sid: props.defaultSid ?? "",
        dealPrice: NaN,
        isBuying: true,
        absDealQuantity: NaN,
        handlingFee: 0,
      };
    }
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <Modal
        title={`${this.props.record ? "編輯" : "新增"}交易紀錄`}
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
            onChange={(dealTime: string) => {
              this.setState({ dealTime: dealTime });
            }}
          />
          <LabeledInput
            title="證券代號"
            value={this.state.sid}
            onChange={(sid: string) => this.setState({ sid: sid })}
            autoFocus={!this.state.sid}
          />
          <div className={styles.row}>
            <LabeledInput
              title="成交單價"
              type="number"
              value={
                this.state.dealPrice || this.state.dealPrice === 0
                  ? this.state.dealPrice.toString()
                  : ""
              }
              onChange={(dealPrice: string) => {
                this.setState({
                  dealPrice: dealPrice === "" ? NaN : parseFloat(dealPrice),
                });
                setTimeout(() => {
                  this.setState({ handlingFee: this.calcDefaultHandlingFee() });
                });
              }}
              autoFocus={Boolean(this.state.sid)}
            />
            <div className={styles.buy_or_sell}>
              <span>買</span>
              <button
                type="button"
                role="switch"
                aria-checked={this.state.isBuying}
                aria-label={this.state.isBuying ? "買" : "賣"}
                className={`${styles.switch} ${
                  this.state.isBuying ? styles.buy : styles.sell
                }`}
                onClick={this.handleClickToggle}
              >
                <span className={styles.switch_thumb} />
              </button>
              <span>賣</span>
            </div>
            <LabeledInput
              title="成交股數"
              type="number"
              value={
                this.state.absDealQuantity || this.state.absDealQuantity === 0
                  ? this.state.absDealQuantity.toString()
                  : ""
              }
              onChange={(absDealQuantity: string) => {
                this.setState({
                  absDealQuantity:
                    absDealQuantity === ""
                      ? NaN
                      : parseInt(absDealQuantity) < 0
                        ? 0
                        : parseInt(absDealQuantity),
                });
                setTimeout(() => {
                  this.setState({ handlingFee: this.calcDefaultHandlingFee() });
                });
              }}
            />
          </div>
          <LabeledInput
            title="手續費用"
            type="number"
            value={
              this.state.handlingFee || this.state.handlingFee === 0
                ? this.state.handlingFee.toString()
                : ""
            }
            onChange={(handlingFee: string) => {
              this.setState({
                handlingFee: handlingFee === "" ? NaN : parseInt(handlingFee),
              });
            }}
          />
        </div>
      </Modal>
    );
  }
  private calcDefaultHandlingFee(): number {
    return Math.max(
      1,
      Math.floor(
        this.state.dealPrice *
          this.state.absDealQuantity *
          (this.state.isBuying ? 0.001425 : 0.004425),
      ),
    );
  }
  private get canSubmit(): boolean {
    return Boolean(
      this.state.dealTime &&
        this.state.sid &&
        !Object.is(this.state.dealPrice, NaN) &&
        !Object.is(this.state.absDealQuantity, NaN) &&
        !Object.is(this.state.handlingFee, NaN) &&
        !this.props.isWaiting,
    );
  }
  private handleClickToggle = (): void => {
    this.setState(
      (state) => {
        return { isBuying: !state.isBuying };
      },
      () => {
        this.setState({ handlingFee: this.calcDefaultHandlingFee() });
      },
    );
  };
  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!this.canSubmit) return;
    try {
      if (this.props.record) {
        // Update
        await this.props
          .dispatch(
            updateRecord({
              id: this.state.recordId!,
              sid: this.state.sid,
              deal_time: this.state.dealTime,
              deal_price: this.state.dealPrice,
              deal_quantity: this.state.isBuying
                ? this.state.absDealQuantity
                : -1 * this.state.absDealQuantity,
              handling_fee: this.state.handlingFee,
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
              deal_price: this.state.dealPrice,
              deal_quantity: this.state.isBuying
                ? this.state.absDealQuantity
                : -1 * this.state.absDealQuantity,
              handling_fee: this.state.handlingFee,
            }),
          )
          .unwrap();
      }
      this.props.hideModal(e);
      this.props.dispatch(fetchSingleStockInfo(this.state.sid));
      this.props.onSave?.();
    } catch (reason: any) {
      this.props.hideModal(e);
    }
  };
}

export default connect(mapStateToProps)(TradeRecordModal);
