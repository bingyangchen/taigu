import React, { MouseEvent, MouseEventHandler } from "react";
import { connect } from "react-redux";

import { LabeledInput, Modal } from "../../components";
import { createPlan, updatePlan } from "../../redux/slices/TradePlanSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { TradePlan } from "../../types";
import Util from "../../utils/util";
import styles from "./TradePlanModal.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.tradePlan;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  defaultSid?: string;
  plan?: TradePlan;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  dispatch: AppDispatch;
}

interface State {
  planId: string | null;
  sid: string;
  targetPrice: number;
  planType: "buy" | "sell";
  targetQuantity: number;
}

class TradePlanModal extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      planId: props.plan?.id.toString() ?? null,
      sid: props.plan?.sid ?? props.defaultSid ?? "",
      targetPrice: props.plan ? props.plan.target_price : NaN,
      planType: props.plan?.plan_type ?? "buy",
      targetQuantity: props.plan ? props.plan.target_quantity : NaN,
    };
  }

  public render(): React.ReactNode {
    return (
      <Modal
        title={`${this.props.plan ? "編輯" : "新增"}買賣計畫`}
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
            title="證券代號"
            value={this.state.sid}
            onChange={(sid: string) => this.setState({ sid: sid })}
            autoFocus={!this.state.sid}
          />
          <div className={styles.row}>
            <LabeledInput
              title="目標價格"
              type="number"
              inputMode="decimal"
              value={
                this.state.targetPrice || this.state.targetPrice === 0
                  ? this.state.targetPrice.toString()
                  : ""
              }
              onChange={this.handleTargetPriceChange}
              autoFocus={Boolean(this.state.sid)}
            />
            <div className={styles.buy_or_sell}>
              <span>買</span>
              <button
                type="button"
                role="switch"
                aria-checked={this.state.planType === "buy"}
                aria-label={this.state.planType === "buy" ? "買" : "賣"}
                className={`${styles.switch} ${
                  this.state.planType === "buy" ? styles.buy : styles.sell
                }`}
                onClick={this.handleClickToggle}
              >
                <span className={styles.switch_thumb} />
              </button>
              <span>賣</span>
            </div>
            <LabeledInput
              title="目標股數"
              type="number"
              inputMode="numeric"
              value={
                this.state.targetQuantity || this.state.targetQuantity === 0
                  ? this.state.targetQuantity.toString()
                  : ""
              }
              onChange={this.handleTargetQuantityChange}
            />
          </div>
          <div className={styles.calculation_row}>
            <div>
              成交金額{" "}
              {(
                this.state.targetPrice * this.state.targetQuantity || "-"
              ).toLocaleString()}{" "}
              元
            </div>
            <div>
              預估手續費{" "}
              {(
                Math.max(
                  1,
                  Math.floor(
                    this.state.targetPrice *
                      this.state.targetQuantity *
                      (this.state.planType === "buy" ? 0.001425 : 0.004425),
                  ),
                ) || "-"
              ).toLocaleString()}{" "}
              元
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  private get canSubmit(): boolean {
    return Boolean(
      this.state.sid &&
        !Object.is(this.state.targetPrice, NaN) &&
        !Object.is(this.state.targetQuantity, NaN) &&
        !this.props.isWaiting,
    );
  }

  private handleTargetPriceChange = (targetPrice: string): void => {
    this.setState({
      targetPrice:
        targetPrice === ""
          ? NaN
          : parseFloat(targetPrice) < 0
            ? 0
            : parseFloat(targetPrice),
    });
  };

  private handleClickToggle = (): void => {
    this.setState((state) => {
      return { planType: state.planType === "buy" ? "sell" : "buy" };
    });
  };

  private handleTargetQuantityChange = (targetQuantity: string): void => {
    this.setState({
      targetQuantity:
        targetQuantity === ""
          ? NaN
          : parseInt(targetQuantity) < 0
            ? 0
            : parseInt(targetQuantity),
    });
  };

  private handleClickSubmit = async (e: MouseEvent): Promise<void> => {
    if (!this.canSubmit) return;
    try {
      if (this.props.plan) {
        // Update
        await this.props
          .dispatch(
            updatePlan({
              id: this.state.planId ?? "",
              sid: this.state.sid,
              target_price: this.state.targetPrice,
              plan_type: this.state.planType,
              target_quantity: this.state.targetQuantity,
            }),
          )
          .unwrap();
      } else {
        // Create
        await this.props
          .dispatch(
            createPlan({
              sid: this.state.sid,
              target_price: this.state.targetPrice,
              target_quantity: this.state.targetQuantity,
              plan_type: this.state.planType,
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

export default connect(mapStateToProps)(TradePlanModal);
