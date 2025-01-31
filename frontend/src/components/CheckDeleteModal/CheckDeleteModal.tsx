import styles from "./CheckDeleteModal.module.scss";

import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { DollarSign, Modal } from "..";
import { deleteRecord as deleteCashDividendRecord } from "../../redux/slices/CashDividendRecordSlice";
import { pushError } from "../../redux/slices/ErrorSlice";
import { deletePlan } from "../../redux/slices/TradePlanSlice";
import { deleteRecord as deleteTradeRecord } from "../../redux/slices/TradeRecordSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { CashDividendRecord, TradePlan, TradeRecord } from "../../types";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
    const { isWaiting: isWaitingTradeRecord } = rootState.tradeRecord;
    const { isWaiting: isWaitingCashDividend } = rootState.cashDividend;
    const { isWaiting: isWaitingTradePlan } = rootState.tradePlan;
    return { isWaitingTradeRecord, isWaitingCashDividend, isWaitingTradePlan };
}

interface Props extends ReturnType<typeof mapStateToProps> {
    target: TradeRecord | CashDividendRecord | TradePlan;
    hideModal: MouseEventHandler;
    onDelete?: () => void;
    dispatch: AppDispatch;
}

interface State {}

class CheckDeleteModal extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }
    public componentDidMount(): void {}
    public render(): React.ReactNode {
        return (
            <Modal
                title="刪除"
                discardButtonProps={{
                    children: "取消",
                    className: "transparent l",
                    onClick: this.props.hideModal,
                }}
                submitButtonProps={{
                    children: "刪除",
                    className: "dangerous l",
                    disabled: this.isWaiting,
                    waiting: this.isWaiting,
                    onClick: this.handleClickCheckDelete,
                }}
                noX
            >
                <div className={styles.modal_inner}>
                    <div className={styles.row}>
                        <span
                            className={styles.company}
                        >{`${this.props.target.sid} ${this.props.target.company_name}`}</span>
                        <span className={styles.price}>
                            <DollarSign />
                            {(Util.isTradeRecord(this.props.target)
                                ? this.props.target.deal_price
                                : Util.isCashDividendRecord(this.props.target)
                                ? this.props.target.cash_dividend
                                : this.props.target.target_price
                            ).toLocaleString()}
                        </span>
                        {!Util.isCashDividendRecord(this.props.target) && (
                            <span className={this.tradeTypeClass}>
                                {this.tradeTypeString}
                            </span>
                        )}
                        {!Util.isCashDividendRecord(this.props.target) && (
                            <span className={styles.quantity}>
                                {Math.abs(
                                    Util.isTradeRecord(this.props.target)
                                        ? this.props.target.deal_quantity
                                        : this.props.target.target_quantity
                                )}{" "}
                                股
                            </span>
                        )}
                        {!Util.isTradePlan(this.props.target) && (
                            <span className={styles.date}>
                                {this.props.target.deal_time}
                            </span>
                        )}
                    </div>
                </div>
            </Modal>
        );
    }
    private get isWaiting(): boolean {
        if (Util.isTradeRecord(this.props.target)) {
            return this.props.isWaitingTradeRecord;
        } else if (Util.isCashDividendRecord(this.props.target)) {
            return this.props.isWaitingCashDividend;
        } else if (Util.isTradePlan(this.props.target)) {
            return this.props.isWaitingTradePlan;
        } else throw Error("Unknown target type.");
    }
    private get tradeTypeClass(): string {
        if (Util.isTradeRecord(this.props.target)) {
            return `${styles.trade_type} ${
                this.props.target.deal_quantity > 0 ? styles.buy : styles.sell
            }`;
        } else if (Util.isTradePlan(this.props.target)) {
            return `${styles.trade_type} ${
                this.props.target.plan_type === "buy" ? styles.buy : styles.sell
            }`;
        } else {
            throw Error("Expect target type to be TradeRecord or TradePlan.");
        }
    }
    private get tradeTypeString(): string {
        if (Util.isTradeRecord(this.props.target)) {
            return this.props.target.deal_quantity > 0 ? "買" : "賣";
        } else if (Util.isTradePlan(this.props.target)) {
            return this.props.target.plan_type === "buy" ? "買" : "賣";
        } else {
            throw Error("Expect target type to be TradeRecord or TradePlan.");
        }
    }
    private handleClickCheckDelete = async (e: MouseEvent): Promise<void> => {
        try {
            if (Util.isTradePlan(this.props.target)) {
                await this.props
                    .dispatch(deletePlan(this.props.target.id))
                    .unwrap();
            } else if (Util.isTradeRecord(this.props.target)) {
                await this.props
                    .dispatch(deleteTradeRecord(this.props.target.id))
                    .unwrap();
            } else if (Util.isCashDividendRecord(this.props.target)) {
                await this.props
                    .dispatch(deleteCashDividendRecord(this.props.target.id))
                    .unwrap();
            } else throw Error("Unknown target type");
            this.props.hideModal(e);
            this.props.onDelete?.();
        } catch (reason: any) {
            this.props.dispatch(pushError({ message: reason.message }));
        }
    };
}

export default connect(mapStateToProps)(CheckDeleteModal);
