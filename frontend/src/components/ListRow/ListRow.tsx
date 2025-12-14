import React, { MouseEventHandler, ReactNode, TouchEvent } from "react";

import { BottomSheet, ListRowActionBar } from "../../components";
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
  children: ReactNode;
  editModal: ((hideModal: MouseEventHandler) => ReactNode) | null;
  deleteModal: ((hideModal: MouseEventHandler) => ReactNode) | null;
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
          {this.props.children}
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

  private get activeModal(): ReactNode {
    const hideModal = Util.getHideModalCallback(this);
    if (this.state.activeModalName === "edit") {
      return this.props.editModal ? this.props.editModal(hideModal) : null;
    } else if (this.state.activeModalName === "checkDelete") {
      return this.props.deleteModal ? this.props.deleteModal(hideModal) : null;
    }
    return null;
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
