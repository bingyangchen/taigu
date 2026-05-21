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
import { createPlan, deletePlan, updatePlan } from "../../redux/slices/TradePlanSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { TradePlan } from "../../types";
import Util from "../../utils/util";
import styles from "./TradePlanEditor.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.tradePlan;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  defaultSid?: string;
  plan?: TradePlan;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  presentation?: "modal" | "page";
  dispatch: AppDispatch;
}

interface State {
  planId: string | null;
  sid: string;
  targetPrice: number;
  planType: "buy" | "sell";
  targetQuantity: number;
  isCheckingDelete: boolean;
}

class TradePlanEditor extends React.Component<Props, State> {
  public state: State;
  private shouldCloseAfterDelete: boolean = false;
  public constructor(props: Props) {
    super(props);
    this.state = {
      planId: props.plan?.id.toString() ?? null,
      sid: props.plan?.sid ?? props.defaultSid ?? "",
      targetPrice: props.plan ? props.plan.target_price : NaN,
      planType: props.plan?.plan_type ?? "buy",
      targetQuantity: props.plan ? props.plan.target_quantity : NaN,
      isCheckingDelete: false,
    };
  }

  public render(): React.ReactNode {
    const title = `${this.props.plan ? "編輯" : "新增"}買賣計畫`;
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
          title="證券代號"
          value={this.state.sid}
          onChange={(sid: string) => this.setState({ sid: sid })}
          autoFocus={!Util.isMobile && !this.props.plan && !this.state.sid}
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
            autoFocus={!Util.isMobile && !this.props.plan && Boolean(this.state.sid)}
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
        {this.props.plan && (
          <DestructiveActionSection
            buttonLabel="刪除買賣計畫"
            description="刪除後無法復原，這個目標價提醒會從買賣計畫中移除。"
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
    if (!this.props.plan) return null;
    return (
      <CheckDeleteModal
        hideModal={this.hideDeleteModal}
        title="刪除買賣計畫？"
        description="刪除後，這個目標價提醒不會再出現在買賣計畫中。"
        submitLabel="刪除買賣計畫"
        isWaiting={this.props.isWaiting}
        nested
        onDelete={this.handleConfirmDelete}
      >
        <DeletePreview
          title={`${this.props.plan.sid} ${this.props.plan.company_name}`}
          details={[
            {
              label: "目標價",
              value: (
                <>
                  <DollarSign />
                  {this.props.plan.target_price.toLocaleString()}
                </>
              ),
            },
            {
              label: "類型",
              value: this.props.plan.plan_type === "buy" ? "買入" : "賣出",
              tone: this.props.plan.plan_type === "buy" ? "buy" : "sell",
            },
            {
              label: "股數",
              value: `${this.props.plan.target_quantity.toLocaleString()} 股`,
            },
          ]}
        />
      </CheckDeleteModal>
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
    if (!this.props.plan) return;
    await this.props.dispatch(deletePlan(this.props.plan.id)).unwrap();
    this.shouldCloseAfterDelete = true;
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

export default connect(mapStateToProps)(TradePlanEditor);
