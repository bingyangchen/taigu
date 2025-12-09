import React, { KeyboardEvent, MouseEvent } from "react";
import { connect } from "react-redux";
import { NavLink } from "react-router-dom";

import {
  CashDividendRecordModal,
  FullLogo,
  NavTab,
  StockSearchModal,
  TradePlanModal,
  TradeRecordModal,
} from "../../components";
import { IconMagnifier, IconPlus } from "../../icons";
import { AppDispatch, RootState } from "../../redux/store";
import { settingsPagePath } from "../../router";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./NavBarForMain.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.account;
  return { isWaiting };
}

interface Props extends ReturnType<typeof mapStateToProps> {
  avatarUrl: string;
  username: string;
  subpages: Subpage[];
  dispatch: AppDispatch;
}

interface State {
  activeModalName:
    | "createTradeRecord"
    | "createCashDividendRecord"
    | "createTradePlan"
    | "search"
    | null;
  isContextMenuOpen: boolean;
}

class NavBarForMain extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { activeModalName: null, isContextMenuOpen: false };
  }
  public componentDidMount(): void {
    document.addEventListener("click", this.handleDocumentClick);
  }
  public componentWillUnmount(): void {
    document.removeEventListener("click", this.handleDocumentClick);
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <NavLink to={`${Env.frontendRootPath}${settingsPagePath}`}>
          <div className={styles.user_info}>
            <img src={this.props.avatarUrl} alt="" />
            <div className={styles.middle}>
              <div className={styles.username}>{this.props.username}</div>
              <div className={styles.hint}>查看帳號與設定</div>
            </div>
          </div>
        </NavLink>
        <div className={styles.subpage_list}>
          {this.props.subpages.map((subpage, idx) => {
            return (
              <NavTab
                page={subpage}
                key={idx}
                changeColor
                end={subpage.path === Env.frontendRootPath}
              />
            );
          })}
          <div
            className={styles.action_button}
            onClick={this.handleAddButtonClick}
            onKeyDown={this.handleAddButtonKeyDown}
            role="button"
            tabIndex={0}
          >
            <div className={styles.icon_outer}>
              <IconPlus sideLength="100%" />
            </div>
            新增
            <div
              className={styles.triangle}
              onClick={this.handleTriangleClick}
              onKeyDown={this.handleTriangleKeyDown}
              role="button"
              tabIndex={0}
            ></div>
            {this.state.isContextMenuOpen && (
              <div className={styles.context_menu}>
                <div
                  className={styles.context_menu_item}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                      isContextMenuOpen: false,
                      activeModalName: "createTradeRecord",
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      this.setState({
                        isContextMenuOpen: false,
                        activeModalName: "createTradeRecord",
                      });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.text}>新增交易紀錄</div>
                </div>
                <div
                  className={styles.context_menu_item}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                      isContextMenuOpen: false,
                      activeModalName: "createCashDividendRecord",
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      this.setState({
                        isContextMenuOpen: false,
                        activeModalName: "createCashDividendRecord",
                      });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.text}>新增現金股利</div>
                </div>
                <div
                  className={styles.context_menu_item}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                      isContextMenuOpen: false,
                      activeModalName: "createTradePlan",
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      this.setState({
                        isContextMenuOpen: false,
                        activeModalName: "createTradePlan",
                      });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.text}>新增買賣計畫</div>
                </div>
              </div>
            )}
          </div>
          <div
            className={styles.action_button}
            onClick={this.handleSearchButtonClick}
            onKeyDown={this.handleSearchButtonKeyDown}
            role="button"
            tabIndex={0}
          >
            <div className={styles.icon_outer}>
              <IconMagnifier sideLength="100%" />
            </div>
            搜尋
          </div>
        </div>
        {this.activeModal}
        <div className={styles.lower}>
          <div className={styles.logo_outer}>
            <FullLogo size="s" />
          </div>
          <div className={styles.copyright}>
            © Taigu 2021-{new Date().getFullYear()}
          </div>
        </div>
      </div>
    );
  }
  private get activeModal(): React.ReactElement | null {
    if (this.state.activeModalName === "createTradeRecord") {
      return <TradeRecordModal hideModal={Util.getHideModalCallback(this)} />;
    } else if (this.state.activeModalName === "createCashDividendRecord") {
      return <CashDividendRecordModal hideModal={Util.getHideModalCallback(this)} />;
    } else if (this.state.activeModalName === "createTradePlan") {
      return <TradePlanModal hideModal={Util.getHideModalCallback(this)} />;
    } else if (this.state.activeModalName === "search") {
      return <StockSearchModal hideModal={Util.getHideModalCallback(this)} />;
    }
    return null;
  }
  private handleAddButtonClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains(styles.triangle) ||
      target.closest(`.${styles.triangle}`) ||
      target.classList.contains(styles.context_menu) ||
      target.closest(`.${styles.context_menu}`)
    ) {
      return;
    }
    this.setState({ activeModalName: "createTradeRecord", isContextMenuOpen: false });
  };
  private handleTriangleClick = (e: MouseEvent): void => {
    e.stopPropagation();
    this.setState((state) => ({ isContextMenuOpen: !state.isContextMenuOpen }));
  };
  private handleAddButtonKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.handleAddButtonClick(e as unknown as MouseEvent);
    }
  };
  private handleTriangleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      this.setState((state) => ({ isContextMenuOpen: !state.isContextMenuOpen }));
    }
  };
  private handleSearchButtonClick = (): void => {
    this.setState({ activeModalName: "search", isContextMenuOpen: false });
  };
  private handleSearchButtonKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.handleSearchButtonClick();
    }
  };
  private handleDocumentClick = (e: Event): void => {
    if (
      this.state.isContextMenuOpen &&
      !(e.target as HTMLElement).closest(`.${styles.context_menu}`) &&
      !(e.target as HTMLElement).closest(`.${styles.action_button}`)
    ) {
      this.setState({ isContextMenuOpen: false });
    }
  };
}

export default connect(mapStateToProps)(NavBarForMain);
