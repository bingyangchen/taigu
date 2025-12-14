import React, { MouseEventHandler, TouchEvent } from "react";

import {
  BottomSheet,
  CashDividendRecordModal,
  CheckDeleteModal,
  DollarSign,
  HandlingFeeDiscountModal,
  ListRowActionBar,
  Modal,
  TradePlanModal,
  TradeRecordModal,
} from "../../components";
import { IRouter, withRouter } from "../../router";
import {
  CashDividendRecord,
  HandlingFeeDiscount,
  TradePlan,
  TradeRecord,
} from "../../types";
import Util from "../../utils/util";
import styles from "./ListRow.module.scss";

interface Props extends IRouter {
  target: TradeRecord | CashDividendRecord | TradePlan | HandlingFeeDiscount;
}

interface State {
  activatedForMobile: boolean;
  isTouching: boolean;
  activeModalName: "edit" | "checkDelete" | null;
}

class ListRow extends React.Component<Props, State> {
  public state: State;
  private timer?: ReturnType<typeof setTimeout>;
  private rippleRef: React.RefObject<HTMLDivElement>;
  public constructor(props: Props) {
    super(props);
    this.state = {
      activatedForMobile: false,
      isTouching: false,
      activeModalName: null,
    };
    this.rippleRef = React.createRef();
  }

  public render(): React.ReactNode {
    return (
      <>
        {this.activeModal}
        <div
          className={`${styles.main} ${
            this.state.activatedForMobile ? styles.active : ""
          }`}
        >
          <span
            className={styles.mask}
            onTouchStart={this.onTouchStart}
            onTouchEnd={this.onTouchEnd}
            onTouchMove={this.onTouchMove}
          >
            {this.state.isTouching && (
              <span className={styles.ripple} ref={this.rippleRef} />
            )}
          </span>
          <span className={styles.company}>
            {Util.isHandlingFeeDiscount(this.props.target)
              ? this.props.target.memo || "手續費折讓"
              : `${this.props.target.sid} ${this.props.target.company_name}`}
          </span>
          <span className={styles.price}>
            <DollarSign />
            {Util.isTradeRecord(this.props.target)
              ? this.props.target.deal_price.toLocaleString()
              : Util.isCashDividendRecord(this.props.target)
                ? this.props.target.cash_dividend.toLocaleString()
                : Util.isHandlingFeeDiscount(this.props.target)
                  ? this.props.target.amount.toLocaleString()
                  : this.props.target.target_price.toLocaleString()}
          </span>
          {!Util.isCashDividendRecord(this.props.target) &&
            !Util.isHandlingFeeDiscount(this.props.target) && (
              <span className={styles.quantity_outer}>
                <span className={this.tradeTypeClassName}>{this.tradeTypeString}</span>
                <span className={styles.quantity}>{this.quantity} 股</span>
              </span>
            )}
          {!Util.isTradePlan(this.props.target) && (
            <span className={styles.date}>
              {Util.isHandlingFeeDiscount(this.props.target)
                ? this.props.target.date
                : this.props.target.deal_time}
            </span>
          )}
          {Util.isMobile ? (
            this.state.activatedForMobile && (
              <BottomSheet onClickBackground={this.handleClickBottomSheetBackground}>
                <ListRowActionBar
                  forMobile
                  onClickEdit={this.handleClickButtonInBottomSheet(
                    this.handleClickEdit,
                  )}
                  onClickDelete={this.handleClickButtonInBottomSheet(
                    this.handleClickDelete,
                  )}
                />
              </BottomSheet>
            )
          ) : (
            <span className={styles.action_bar_outer}>
              <ListRowActionBar
                onClickEdit={this.handleClickEdit}
                onClickDelete={this.handleClickDelete}
              />
            </span>
          )}
        </div>
      </>
    );
  }

  private get activeModal(): React.ReactElement<typeof Modal> | null {
    if (this.state.activeModalName === "edit") {
      return Util.isTradeRecord(this.props.target) ? (
        <TradeRecordModal
          record={this.props.target}
          hideModal={Util.getHideModalCallback(this)}
        />
      ) : Util.isCashDividendRecord(this.props.target) ? (
        <CashDividendRecordModal
          record={this.props.target}
          hideModal={Util.getHideModalCallback(this)}
        />
      ) : Util.isHandlingFeeDiscount(this.props.target) ? (
        <HandlingFeeDiscountModal
          record={this.props.target}
          hideModal={Util.getHideModalCallback(this)}
        />
      ) : (
        <TradePlanModal
          plan={this.props.target}
          hideModal={Util.getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "checkDelete") {
      return (
        <CheckDeleteModal
          target={this.props.target}
          hideModal={Util.getHideModalCallback(this)}
        />
      );
    }
    return null;
  }

  private get tradeTypeClassName(): string {
    if (Util.isTradeRecord(this.props.target)) {
      return (
        styles.trade_type +
        " " +
        (this.props.target.deal_quantity > 0 ? styles.buy : styles.sell)
      );
    } else if (Util.isTradePlan(this.props.target)) {
      return (
        styles.trade_type +
        " " +
        (this.props.target.plan_type === "buy" ? styles.buy : styles.sell)
      );
    } else throw Error("TypeError");
  }

  private get tradeTypeString(): "買" | "賣" {
    if (Util.isTradeRecord(this.props.target)) {
      return this.props.target.deal_quantity > 0 ? "買" : "賣";
    } else if (Util.isTradePlan(this.props.target)) {
      return this.props.target.plan_type === "buy" ? "買" : "賣";
    } else throw Error("TypeError");
  }

  private get quantity(): number {
    if (Util.isTradeRecord(this.props.target)) {
      return Math.abs(this.props.target.deal_quantity);
    } else if (Util.isTradePlan(this.props.target)) {
      return this.props.target.target_quantity;
    } else throw Error("TypeError");
  }

  private handleClickEdit = (): void => {
    this.setState({ activeModalName: "edit" });
  };

  private handleClickDelete = (): void => {
    this.setState({ activeModalName: "checkDelete" });
  };

  private handleClickButtonInBottomSheet = (callback: Function): MouseEventHandler => {
    return (): void => {
      if (this.props.router.location.hash === "#!") {
        this.props.router.navigate(-1);
      }
      setTimeout(() => {
        this.handleClickBottomSheetBackground();
        callback();
      });
    };
  };

  private onTouchStart = (e: TouchEvent): void => {
    this.timer = setTimeout(() => this.setState({ activatedForMobile: true }), 500);
    if (this.state.isTouching) {
      this.setState({ isTouching: false });
      return;
    }
    const mask = e.currentTarget as HTMLElement;
    const diameter = Math.max(mask.clientWidth, mask.clientHeight);
    const touch = e.touches[0];
    this.setState({ isTouching: true }, () => {
      if (!this.rippleRef.current) return;
      this.rippleRef.current.style.width =
        this.rippleRef.current.style.height = `${diameter}px`;
      this.rippleRef.current.style.left = `${
        touch.clientX - mask.getBoundingClientRect().left - diameter / 2
      }px`;
      this.rippleRef.current.style.top = `${
        touch.clientY - mask.getBoundingClientRect().top - diameter / 2
      }px`;
    });
  };

  private onTouchEnd = (): void => {
    this.setState({ isTouching: false });
    clearTimeout(this.timer);
  };

  private onTouchMove = (): void => {
    clearTimeout(this.timer);
  };

  private handleClickBottomSheetBackground = (): void => {
    this.setState({ activatedForMobile: false });
  };
}

export default withRouter(ListRow);
