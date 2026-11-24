import React, { KeyboardEvent, MouseEvent } from "react";
import { connect } from "react-redux";
import { NavLink } from "react-router-dom";

import {
  CashDividendRecordEditor,
  FullLogo,
  NavTab,
  StockSearchModal,
  Tooltip,
  TradePlanEditor,
  TradeRecordEditor,
} from "../../components";
import * as Icons from "../../icons";
import { AppDispatch, RootState } from "../../redux/store";
import { settingsPagePath } from "../../router";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import { mainTabNavigationState } from "../../utils/mainNavigation";
import { getHideModalCallback } from "../../utils/modal";
import styles from "./MainSideBar.module.scss";
import {
  isMainNavCollapsedInStorage,
  saveMainNavCollapsed,
  toggleMainNavCollapsed,
} from "./sidebarState";

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

const WIDE_MEDIA_QUERY = "(min-width: 960px)";

interface State {
  isCollapsed: boolean;
  isWide: boolean;
  activeModalName:
    | "createTradeRecord"
    | "createCashDividendRecord"
    | "createTradePlan"
    | "search"
    | null;
  isContextMenuOpen: boolean;
}

class MainSideBar extends React.Component<Props, State> {
  public state: State;
  private wideMediaQueryList: MediaQueryList;
  public constructor(props: Props) {
    super(props);
    this.wideMediaQueryList = window.matchMedia(WIDE_MEDIA_QUERY);
    this.state = {
      isCollapsed: isMainNavCollapsedInStorage(),
      isWide: this.wideMediaQueryList.matches,
      activeModalName: null,
      isContextMenuOpen: false,
    };
  }
  public componentDidMount(): void {
    document.addEventListener("click", this.handleDocumentClick);
    this.wideMediaQueryList.addEventListener("change", this.handleWideMediaChange);
  }
  public componentWillUnmount(): void {
    document.removeEventListener("click", this.handleDocumentClick);
    this.wideMediaQueryList.removeEventListener("change", this.handleWideMediaChange);
  }
  public render(): React.ReactNode {
    const showsIconOnly = this.state.isCollapsed && this.state.isWide;
    const collapseLabel = this.state.isCollapsed ? "展開側邊欄" : "收合側邊欄";
    return (
      <div className={`${styles.main} ${showsIconOnly ? styles.collapsed : ""}`}>
        <div className={styles.profile_row}>
          <WithTooltip content="查看帳號與設定" enabled={showsIconOnly}>
            <NavLink
              to={`${Env.frontendRootPath}${settingsPagePath}`}
              state={mainTabNavigationState}
              className={styles.profile_link}
              aria-label={showsIconOnly ? "查看帳號與設定" : undefined}
            >
              <div className={styles.user_info}>
                <img src={this.props.avatarUrl} alt="" />
                <div className={styles.middle}>
                  <div className={styles.username}>{this.props.username}</div>
                  <div className={styles.hint}>查看帳號與設定</div>
                </div>
              </div>
            </NavLink>
          </WithTooltip>
          {this.state.isWide && (
            <Tooltip content={collapseLabel} side="right">
              <button
                type="button"
                className={styles.collapse_button}
                aria-expanded={!this.state.isCollapsed}
                aria-label={collapseLabel}
                onClick={this.toggleCollapsed}
              >
                <Icons.IconSidebar sideLength="16" />
              </button>
            </Tooltip>
          )}
        </div>
        <div className={styles.subpage_list}>
          {this.props.subpages.map((subpage, idx) => {
            return (
              <NavTab
                page={subpage}
                key={idx}
                changeColor
                restoreTabPosition
                end={subpage.path === Env.frontendRootPath}
                iconOnlyLabel={showsIconOnly ? subpage.name : undefined}
                iconOnly={showsIconOnly}
              />
            );
          })}
          <WithTooltip content="新增" enabled={showsIconOnly}>
            <div
              className={styles.action_button}
              onClick={this.handleAddButtonClick}
              onKeyDown={this.handleAddButtonKeyDown}
              role="button"
              tabIndex={0}
              aria-label={showsIconOnly ? "新增" : undefined}
            >
              <div className={styles.icon_outer}>
                <Icons.IconPlus sideLength="100%" />
              </div>
              <span className={styles.action_label}>新增</span>
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
          </WithTooltip>
          <WithTooltip content="搜尋" enabled={showsIconOnly}>
            <div
              className={styles.action_button}
              onClick={this.handleSearchButtonClick}
              onKeyDown={this.handleSearchButtonKeyDown}
              role="button"
              tabIndex={0}
              aria-label={showsIconOnly ? "搜尋" : undefined}
            >
              <div className={styles.icon_outer}>
                <Icons.IconMagnifier sideLength="100%" />
              </div>
              <span className={styles.action_label}>搜尋</span>
            </div>
          </WithTooltip>
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
      return <TradeRecordEditor hideModal={getHideModalCallback(this)} />;
    } else if (this.state.activeModalName === "createCashDividendRecord") {
      return <CashDividendRecordEditor hideModal={getHideModalCallback(this)} />;
    } else if (this.state.activeModalName === "createTradePlan") {
      return <TradePlanEditor hideModal={getHideModalCallback(this)} />;
    } else if (this.state.activeModalName === "search") {
      return <StockSearchModal hideModal={getHideModalCallback(this)} />;
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
  private toggleCollapsed = (): void => {
    const nextIsCollapsed = toggleMainNavCollapsed(this.state.isCollapsed);
    this.setState({ isCollapsed: nextIsCollapsed });
    saveMainNavCollapsed(nextIsCollapsed);
  };
  private handleWideMediaChange = (event: MediaQueryListEvent): void => {
    this.setState({ isWide: event.matches });
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

function WithTooltip({
  content,
  enabled,
  children,
}: {
  content: string;
  enabled: boolean;
  children: React.ReactElement;
}): React.ReactElement {
  return enabled ? (
    <Tooltip content={content} side="right">
      {children}
    </Tooltip>
  ) : (
    children
  );
}

export { MainSideBar };
export default connect(mapStateToProps)(MainSideBar);
