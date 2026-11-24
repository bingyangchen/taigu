import React, { type MouseEvent } from "react";

import {
  CashDividendRecordEditor,
  Modal,
  StockSearchModal,
  Tooltip,
  TradePlanEditor,
  TradeRecordEditor,
} from "../../components";
import * as Icons from "../../icons";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import { getHideModalCallback } from "../../utils/modal";
import Util from "../../utils/util";
import styles from "./SpeedDial.module.scss";

interface Props extends IRouter {
  defaultSid?: string;
}

interface State {
  activeModalName:
    | "createTradeRecord"
    | "createCashDividendRecord"
    | "createTradePlan"
    | "search"
    | null;
}

class SpeedDial extends React.Component<Props, State> {
  public state: State;
  private readonly trigger = React.createRef<HTMLButtonElement>();
  private readonly options = React.createRef<HTMLDivElement>();
  private previousOverscroll: string | null = null;
  public constructor(props: Props) {
    super(props);
    this.state = { activeModalName: null };
  }
  public componentDidMount(): void {
    this.syncOverscroll();
  }
  public getSnapshotBeforeUpdate(prevProps: Readonly<Props>): boolean {
    return (
      prevProps.router.location.hash === "#@" &&
      !this.isActive &&
      (this.options.current?.contains(document.activeElement) ?? false)
    );
  }
  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    focusWasInOptions: boolean,
  ): void {
    if (prevProps.router.location.hash !== this.props.router.location.hash) {
      this.syncOverscroll();
    }
    if (this.state.activeModalName) return;
    if (prevState.activeModalName) {
      requestAnimationFrame(() => this.trigger.current?.focus({ preventScroll: true }));
    } else if (focusWasInOptions) {
      this.trigger.current?.focus({ preventScroll: true });
    }
  }
  public componentWillUnmount(): void {
    this.restoreOverscroll();
  }

  private get isActive(): boolean {
    return this.props.router.location.hash === "#@";
  }

  private syncOverscroll(): void {
    if (this.isActive) {
      this.previousOverscroll ??= document.body.style.overscrollBehaviorY;
      document.body.style.overscrollBehaviorY = "contain";
      window.addEventListener("keydown", this.handleKeyDown, true);
    } else {
      this.restoreOverscroll();
    }
  }

  private restoreOverscroll(): void {
    window.removeEventListener("keydown", this.handleKeyDown, true);
    if (this.previousOverscroll === null) return;
    document.body.style.overscrollBehaviorY = this.previousOverscroll;
    this.previousOverscroll = null;
  }

  public render(): React.ReactNode {
    return (
      <>
        {this.activeModal}
        <div className={`${styles.main} ${this.isActive ? styles.active : ""}`}>
          <Tooltip content="新增或搜尋" side="left">
            <button
              type="button"
              className={styles.trigger}
              ref={this.trigger}
              aria-label="新增或搜尋"
              aria-expanded={this.isActive}
              onClick={this.toggle}
            >
              <Icons.IconPlus sideLength="26" />
            </button>
          </Tooltip>
          <div className={styles.button_container} ref={this.options}>
            <button
              type="button"
              className={styles.button}
              onClick={this.handleCreateTradeRecord}
            >
              <Icons.IconPencilSquare sideLength="20" />
              <span className={styles.hint_text}>新增交易紀錄</span>
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={this.handleCreateCashDividendRecord}
            >
              <Icons.IconCoin sideLength="20" />
              <span className={styles.hint_text}>新增現金股利</span>
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={this.handleCreateTradePlan}
            >
              <Icons.IconThumbtack sideLength="20" />
              <span className={styles.hint_text}>新增買賣計畫</span>
            </button>
            <button type="button" className={styles.button} onClick={this.handleSearch}>
              <Icons.IconMagnifier sideLength="20" />
              <span className={styles.hint_text}>搜尋</span>
            </button>
          </div>
        </div>
        <div className={styles.background} onClick={this.hide} />
      </>
    );
  }
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      !this.isActive ||
      this.state.activeModalName
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.trigger.current?.focus();
    this.hide();
  };
  private get activeModal(): React.ReactElement<typeof Modal> | null {
    if (this.state.activeModalName === "createTradeRecord") {
      return (
        <TradeRecordEditor
          defaultSid={this.props.defaultSid}
          hideModal={getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "createCashDividendRecord") {
      return (
        <CashDividendRecordEditor
          defaultSid={this.props.defaultSid}
          hideModal={getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "createTradePlan") {
      return (
        <TradePlanEditor
          defaultSid={this.props.defaultSid}
          hideModal={getHideModalCallback(this)}
        />
      );
    } else if (this.state.activeModalName === "search") {
      return <StockSearchModal hideModal={getHideModalCallback(this)} />;
    }
    return null;
  }
  private toggle = (event: MouseEvent): void => {
    event.stopPropagation();
    if (this.isActive) {
      this.hide();
      return;
    }

    const { location, navigate } = this.props.router;
    navigate(
      { search: location.search, hash: "#@" },
      { state: { ...location.state, speedDialOpen: true } },
    );
  };
  private hide = (): void => {
    if (!this.isActive) return;
    const { location, navigate } = this.props.router;
    if (location.state?.speedDialOpen === true) {
      navigate(-1);
    } else {
      navigate(
        { search: location.search, hash: "" },
        { replace: true, state: location.state },
      );
    }
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
  private handleSearch = (e: MouseEvent): void => {
    e.stopPropagation();
    if (Util.isMobile) {
      this.props.router.navigate(`${Env.frontendRootPath}search`, {
        replace: this.isActive,
      });
      return;
    }
    this.hide();
    this.setState({ activeModalName: "search" });
  };
  private openEditorRouteOrModal = (
    mobilePath: string,
    modalName: Exclude<State["activeModalName"], "search" | null>,
  ): void => {
    if (Util.isMobile) {
      this.props.router.navigate(mobilePath, { replace: this.isActive });
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
