import React, { MouseEvent } from "react";

import {
  CashDividendRecordModal,
  Modal,
  StockSearchModal,
  TradePlanModal,
  TradeRecordModal,
} from "../../components";
import {
  IconCoin,
  IconMagnifier,
  IconPencilSquare,
  IconPlus,
  IconThumbtack,
} from "../../icons";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./SpeedDial.module.scss";

interface Props extends IRouter {
  defaultSid?: string;
}

interface State {
  isActive: boolean;
  activeModalName:
    | "createTradeRecord"
    | "createCashDividendRecord"
    | "createTradePlan"
    | "search"
    | null;
}

class SpeedDial extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { isActive: false, activeModalName: null };
  }
  public componentDidMount(): void {}
  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.router.location.hash === "#@" &&
      this.props.router.location.hash === ""
    ) {
      this.hide();
    }
  }
  public componentWillUnmount(): void {}
  public render(): React.ReactNode {
    return (
      <>
        {this.activeModal}
        <div
          className={`${styles.main} ${this.state.isActive ? styles.active : ""}`}
          onClick={this.toggle}
        >
          <IconPlus sideLength="26" />
          <div className={styles.button_container}>
            <div className={styles.button} onClick={this.handleCreateTradeRecord}>
              <IconPencilSquare sideLength="20" />
              <div className={styles.hint_text}>新增交易紀錄</div>
            </div>
            <div
              className={styles.button}
              onClick={this.handleCreateCashDividendRecord}
            >
              <IconCoin sideLength="20" />
              <div className={styles.hint_text}>新增現金股利</div>
            </div>
            <div className={styles.button} onClick={this.handleCreateTradePlan}>
              <IconThumbtack sideLength="20" />
              <div className={styles.hint_text}>新增買賣計畫</div>
            </div>
            <div
              className={styles.button}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                this.hide();
                this.setState({ activeModalName: "search" });
              }}
            >
              <IconMagnifier sideLength="20" />
              <div className={styles.hint_text}>搜尋</div>
            </div>
          </div>
        </div>
        <div className={styles.background} onClick={this.hide} />
      </>
    );
  }
  private get activeModal(): React.ReactElement<typeof Modal> | null {
    if (this.state.activeModalName === "createTradeRecord") {
      return (
        <TradeRecordModal
          defaultSid={this.props.defaultSid}
          hideModal={Util.getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "createCashDividendRecord") {
      return (
        <CashDividendRecordModal
          defaultSid={this.props.defaultSid}
          hideModal={Util.getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "createTradePlan") {
      return (
        <TradePlanModal
          defaultSid={this.props.defaultSid}
          hideModal={Util.getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "search") {
      return (
        <StockSearchModal hideModal={Util.getHideModalCallback(this)} fullScreenPage />
      );
    }
    return null;
  }
  private toggle = (e: MouseEvent): void => {
    e.stopPropagation();
    this.setState((state) => {
      if (state.isActive) {
        setTimeout(() => {
          if (this.props.router.location.hash === "#@") {
            this.props.router.navigate(-1);
          }
          document.body.style.overscrollBehaviorY = "initial";
        });
      } else {
        document.body.style.overscrollBehaviorY = "contain";
        setTimeout(() => {
          this.props.router.navigate("#@");
        });
      }
      return { isActive: !state.isActive };
    });
  };
  private hide = (): void => {
    if (this.props.router.location.hash === "#@") this.props.router.navigate(-1);
    document.body.style.overscrollBehaviorY = "initial";
    this.setState({ isActive: false });
  };
  private handleCreateTradeRecord = (e: MouseEvent): void => {
    e.stopPropagation();
    this.openEditorRouteOrModal(
      `${Env.frontendRootPath}records/trade/new${this.defaultSidSearch}`,
      "createTradeRecord",
    );
  };
  private handleCreateCashDividendRecord = (e: MouseEvent): void => {
    e.stopPropagation();
    this.openEditorRouteOrModal(
      `${Env.frontendRootPath}records/cash-dividend/new${this.defaultSidSearch}`,
      "createCashDividendRecord",
    );
  };
  private handleCreateTradePlan = (e: MouseEvent): void => {
    e.stopPropagation();
    this.openEditorRouteOrModal(
      `${Env.frontendRootPath}plans/new${this.defaultSidSearch}`,
      "createTradePlan",
    );
  };
  private openEditorRouteOrModal = (
    mobilePath: string,
    modalName: Exclude<State["activeModalName"], "search" | null>,
  ): void => {
    if (Util.isMobile) {
      document.body.style.overscrollBehaviorY = "initial";
      this.setState({ isActive: false, activeModalName: null });
      this.props.router.navigate(mobilePath, {
        replace: this.props.router.location.hash === "#@",
      });
      return;
    }
    this.hide();
    this.setState({ activeModalName: modalName });
  };
  private get defaultSidSearch(): string {
    return this.props.defaultSid
      ? `?sid=${encodeURIComponent(this.props.defaultSid)}`
      : "";
  }
}

export default withRouter(SpeedDial);
