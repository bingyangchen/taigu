import logo from "../../assets/logo.png";
import styles from "./StretchableButton.module.scss";

import React, { MouseEvent } from "react";

import {
  CashDividendRecordModal,
  Modal,
  StockSearchModal,
  TradePlanModal,
  TradeRecordModal,
} from "..";
import {
  IconBrandStrategy,
  IconCoin,
  IconMagnifier,
  IconPencilSquare,
} from "../../icons";
import { IRouter, withRouter } from "../../router";
import Util from "../../utils/util";

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

class StretchableButton extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      isActive: false,
      activeModalName: null,
    };
  }
  public componentDidMount(): void {}
  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any
  ): void {
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
          <img className={styles.button_image} src={logo} alt="" />
          <div className={styles.button_container}>
            <div
              className={styles.button}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                this.hide();
                this.setState({ activeModalName: "createTradeRecord" });
              }}
            >
              <IconPencilSquare sideLength="20" />
              <div className={styles.hint_text}>交易紀錄</div>
            </div>
            <div
              className={styles.button}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                this.hide();
                this.setState({ activeModalName: "createCashDividendRecord" });
              }}
            >
              <IconCoin sideLength="20" />
              <div className={styles.hint_text}>現金股利</div>
            </div>
            <div
              className={styles.button}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                this.hide();
                this.setState({ activeModalName: "createTradePlan" });
              }}
            >
              <IconBrandStrategy sideLength="20" />
              <div className={styles.hint_text}>買賣計畫</div>
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
      return <StockSearchModal hideModal={Util.getHideModalCallback(this)} />;
    }
    return null;
  }
  private toggle = (e: MouseEvent): void => {
    e.stopPropagation();
    this.setState((state, props) => {
      if (state.isActive) {
        setTimeout(() => {
          if (this.props.router.location.hash === "#@") {
            this.props.router.navigate(-1);
          }
          Util.changePWAThemeColor("#fff");
          document.body.style.overscrollBehaviorY = "initial";
        });
      } else {
        document.body.style.overscrollBehaviorY = "contain";
        setTimeout(() => {
          this.props.router.navigate("#@");
          Util.changePWAThemeColor("#888");
        });
      }
      return { isActive: !state.isActive };
    });
  };
  private hide = (): void => {
    if (this.props.router.location.hash === "#@") this.props.router.navigate(-1);
    document.body.style.overscrollBehaviorY = "initial";
    Util.changePWAThemeColor("#fff");
    this.setState({ isActive: false });
  };
}

export default withRouter(StretchableButton);
