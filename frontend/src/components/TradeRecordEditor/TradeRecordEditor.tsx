import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import {
  CheckDeleteModal,
  DeletePreview,
  DestructiveActionSection,
  DollarSign,
  FormPageShell,
  LabeledInput,
  Modal,
} from "../../components";
import { fetchSingleStockInfo } from "../../redux/slices/StockInfoSlice";
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from "../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { TradeRecord } from "../../types";
import Util from "../../utils/util";
import styles from "./TradeRecordEditor.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.tradeRecord;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  defaultSid?: string;
  record?: TradeRecord;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  presentation?: "modal" | "page";
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
  isCheckingDelete: boolean;
}

class TradeRecordEditor extends React.Component<Props, State> {
  public state: State;
  private shouldCloseAfterDelete: boolean = false;
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
        isCheckingDelete: false,
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
        isCheckingDelete: false,
      };
    }
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    const title = `${this.props.record ? "編輯" : "新增"}交易紀錄`;
    const discardButtonProps = {
      children: "捨棄",
      className: "transparent l",
      onClick: this.props.hideModal,
    };
    const submitButtonProps = {
      children: "送出",
      className: "primary_fill l",
      disabled: !this.canSubmit,
      waiting: this.props.isWaiting,
      onClick: this.handleClickSubmit,
      canTriggerByEnter: true,
    };
    const body = (
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
          autoFocus={!Util.isMobile && !this.props.record && !this.state.sid}
        />
        <div className={styles.row}>
          <LabeledInput
            title="成交單價"
            type="number"
            inputMode="decimal"
            value={
              this.state.dealPrice || this.state.dealPrice === 0
                ? this.state.dealPrice.toString()
                : ""
            }
            onChange={this.handleDealPriceChange}
            autoFocus={!Util.isMobile && !this.props.record && Boolean(this.state.sid)}
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
            inputMode="numeric"
            value={
              this.state.absDealQuantity || this.state.absDealQuantity === 0
                ? this.state.absDealQuantity.toString()
                : ""
            }
            onChange={this.handleAbsDealQuantityChange}
          />
        </div>
        <LabeledInput
          title="手續費用"
          type="number"
          inputMode="numeric"
          value={
            this.state.handlingFee || this.state.handlingFee === 0
              ? this.state.handlingFee.toString()
              : ""
          }
          onChange={this.handleHandlingFeeChange}
        />
        {this.props.record && (
          <DestructiveActionSection
            buttonLabel="刪除交易紀錄"
            description="刪除後無法復原，投資績效、持股與手續費統計會同步更新。"
            onClick={this.handleClickDelete}
          />
        )}
      </div>
    );
    return (
      <>
        {this.props.presentation === "page" ? (
          <FormPageShell
            title={title}
            discardButtonProps={discardButtonProps}
            submitButtonProps={submitButtonProps}
          >
            {body}
          </FormPageShell>
        ) : (
          <Modal
            title={title}
            discardButtonProps={discardButtonProps}
            submitButtonProps={submitButtonProps}
            layout={Util.isMobile ? "fullScreen" : "compact"}
            noX
            silentBackground
          >
            {body}
          </Modal>
        )}
        {this.state.isCheckingDelete && this.renderDeleteModal()}
      </>
    );
  }

  private renderDeleteModal(): React.ReactNode {
    if (!this.props.record) return null;
    return (
      <CheckDeleteModal
        hideModal={this.hideDeleteModal}
        title="刪除交易紀錄？"
        description="刪除後，這筆紀錄會從投資績效、持股與手續費統計中移除。"
        submitLabel="刪除交易紀錄"
        isWaiting={this.props.isWaiting}
        nested
        onDelete={this.handleConfirmDelete}
      >
        <DeletePreview
          title={`${this.props.record.sid} ${this.props.record.company_name}`}
          meta={this.props.record.deal_time}
          details={[
            {
              label: "成交價",
              value: (
                <>
                  <DollarSign />
                  {this.props.record.deal_price.toLocaleString()}
                </>
              ),
            },
            {
              label: "類型",
              value: this.props.record.deal_quantity > 0 ? "買入" : "賣出",
              tone: this.props.record.deal_quantity > 0 ? "buy" : "sell",
            },
            {
              label: "股數",
              value: `${Math.abs(this.props.record.deal_quantity).toLocaleString()} 股`,
            },
          ]}
        />
      </CheckDeleteModal>
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

  private handleDealPriceChange = (dealPrice: string): void => {
    const parsedPrice =
      dealPrice === "" ? NaN : parseFloat(dealPrice) < 0 ? 0 : parseFloat(dealPrice);
    this.setState({ dealPrice: parsedPrice }, () => {
      this.setState({ handlingFee: this.calcDefaultHandlingFee() });
    });
  };

  private handleAbsDealQuantityChange = (absDealQuantity: string): void => {
    const parsedQuantity =
      absDealQuantity === ""
        ? NaN
        : parseInt(absDealQuantity) < 0
          ? 0
          : parseInt(absDealQuantity);
    this.setState({ absDealQuantity: parsedQuantity }, () =>
      this.setState({ handlingFee: this.calcDefaultHandlingFee() }),
    );
  };

  private handleHandlingFeeChange = (handlingFee: string): void => {
    const parsedFee =
      handlingFee === "" ? NaN : parseInt(handlingFee) < 0 ? 0 : parseInt(handlingFee);
    this.setState({ handlingFee: parsedFee });
  };

  private handleClickDelete = (): void => {
    this.setState({ isCheckingDelete: true });
  };

  private hideDeleteModal = (e: MouseEvent): void => {
    if (this.shouldCloseAfterDelete) {
      this.shouldCloseAfterDelete = false;
      this.props.hideModal(e);
      return;
    }
    this.setState({ isCheckingDelete: false });
  };

  private handleConfirmDelete = async (): Promise<void> => {
    if (!this.props.record) return;
    await this.props.dispatch(deleteRecord(this.props.record.id)).unwrap();
    this.shouldCloseAfterDelete = true;
  };

  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!this.canSubmit) return;
    try {
      if (this.props.record) {
        // Update
        await this.props
          .dispatch(
            updateRecord({
              id: this.state.recordId ?? "",
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
    } catch (reason) {
      this.props.hideModal(e);
    }
  };
}

export default connect(mapStateToProps)(TradeRecordEditor);
