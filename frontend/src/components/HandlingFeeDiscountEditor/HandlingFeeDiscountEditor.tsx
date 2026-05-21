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
import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from "../../redux/slices/HandlingFeeDiscountSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import type { HandlingFeeDiscount } from "../../types";
import Util from "../../utils/util";
import styles from "./HandlingFeeDiscountEditor.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.handlingFeeDiscount;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  record?: HandlingFeeDiscount;
  hideModal: MouseEventHandler;
  onSave?: () => void;
  presentation?: "modal" | "page";
  dispatch: AppDispatch;
}

interface State {
  recordId: number | null;
  date: string;
  amount: number;
  memo: string;
  isCheckingDelete: boolean;
}

type HandlingFeeDiscountFormState = Omit<State, "isCheckingDelete">;

class HandlingFeeDiscountEditor extends React.Component<Props, State> {
  public state: State;
  private initialFormState: HandlingFeeDiscountFormState;
  private shouldCloseAfterDelete: boolean = false;
  public constructor(props: Props) {
    super(props);
    this.initialFormState = {
      recordId: props.record?.id ?? null,
      date: props.record?.date ?? new Date().toLocaleDateString("af"),
      amount: props.record ? props.record.amount : NaN,
      memo: props.record?.memo ?? "",
    };
    this.state = { ...this.initialFormState, isCheckingDelete: false };
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    const title = `${this.props.record ? "編輯" : "新增"}折讓紀錄`;
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
          autoFocus={!Util.isMobile && !this.props.record && Boolean(this.state.date)}
        />
        <LabeledInput
          title="備註"
          type="text"
          value={this.state.memo}
          onChange={(memo: string) => this.setState({ memo: memo })}
        />
        {this.props.record && (
          <DestructiveActionSection
            buttonLabel="刪除折讓紀錄"
            description="刪除後無法復原，手續費分析會同步更新。"
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
            isDirty={this.isDirty}
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
        title="刪除手續費折讓？"
        description="刪除後，這筆折讓不會再計入手續費分析。"
        submitLabel="刪除折讓紀錄"
        isWaiting={this.props.isWaiting}
        nested
        onDelete={this.handleConfirmDelete}
      >
        <DeletePreview
          title={this.props.record.memo || "手續費折讓"}
          meta={this.props.record.date}
          details={[
            {
              label: "折讓金額",
              value: (
                <>
                  <DollarSign />
                  {this.props.record.amount.toLocaleString()}
                </>
              ),
            },
          ]}
        />
      </CheckDeleteModal>
    );
  }
  private get canSubmit(): boolean {
    return Boolean(
      this.state.date && !Object.is(this.state.amount, NaN) && !this.props.isWaiting,
    );
  }
  private get isDirty(): boolean {
    return (
      this.state.recordId !== this.initialFormState.recordId ||
      this.state.date !== this.initialFormState.date ||
      !Object.is(this.state.amount, this.initialFormState.amount) ||
      this.state.memo !== this.initialFormState.memo
    );
  }
  private handleAmountChange = (amount: string): void => {
    this.setState({
      amount: amount === "" ? NaN : parseInt(amount) < 0 ? 0 : parseInt(amount),
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
    if (!this.props.record) return;
    await this.props.dispatch(deleteDiscount(this.props.record.id)).unwrap();
    this.shouldCloseAfterDelete = true;
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

export default connect(mapStateToProps)(HandlingFeeDiscountEditor);
