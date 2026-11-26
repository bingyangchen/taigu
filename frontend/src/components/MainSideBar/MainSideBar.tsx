import React, {
  KeyboardEvent,
  memo,
  MouseEvent,
  useLayoutEffect,
  useState,
} from "react";
import { NavLink } from "react-router-dom";

import { FullLogo, NavTab, Tooltip } from "../../components";
import * as Icons from "../../icons";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import { mainTabNavigationState } from "../../utils/mainNavigation";
import { makeWidthAtLeastQuery } from "../../utils/mediaQuery";
import { settingsPagePath } from "../../utils/router";
import { useLatestRef } from "../../utils/useLatestRef";
import AddOrSearchModal, {
  type AddOrSearchModalName,
} from "../AddOrSearchModal/AddOrSearchModal";
import styles from "./MainSideBar.module.scss";
import {
  isMainNavCollapsedInStorage,
  saveMainNavCollapsed,
  toggleMainNavCollapsed,
} from "./sidebarState";

interface Props {
  avatarUrl: string;
  username: string;
  subpages: Subpage[];
}

const WIDE_MEDIA_QUERY = makeWidthAtLeastQuery("lg");

const CONTEXT_MENU_ITEMS: { modalName: AddOrSearchModalName; label: string }[] = [
  { modalName: "createTradeRecord", label: "新增交易紀錄" },
  { modalName: "createCashDividendRecord", label: "新增現金股利" },
  { modalName: "createTradePlan", label: "新增買賣計畫" },
];

function isActivationKey(e: KeyboardEvent): boolean {
  return e.key === "Enter" || e.key === " ";
}

function MainSideBar({ avatarUrl, username, subpages }: Props) {
  const [wideMediaQueryList] = useState(() => window.matchMedia(WIDE_MEDIA_QUERY));
  const [isCollapsed, setIsCollapsed] = useState(isMainNavCollapsedInStorage);
  const [isWide, setIsWide] = useState(wideMediaQueryList.matches);
  const [activeModalName, setActiveModalName] = useState<AddOrSearchModalName | null>(
    null,
  );
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const isContextMenuOpenRef = useLatestRef(isContextMenuOpen);

  useLayoutEffect(() => {
    const handleDocumentClick = (e: Event): void => {
      if (
        isContextMenuOpenRef.current &&
        !(e.target as HTMLElement).closest(`.${styles.context_menu}`) &&
        !(e.target as HTMLElement).closest(`.${styles.action_button}`)
      ) {
        setIsContextMenuOpen(false);
      }
    };
    const handleWideMediaChange = (event: MediaQueryListEvent): void => {
      setIsWide(event.matches);
    };
    document.addEventListener("click", handleDocumentClick);
    wideMediaQueryList.addEventListener("change", handleWideMediaChange);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      wideMediaQueryList.removeEventListener("change", handleWideMediaChange);
    };
  }, [isContextMenuOpenRef, wideMediaQueryList]);

  const openModal = (modalName: AddOrSearchModalName): void => {
    setActiveModalName(modalName);
    setIsContextMenuOpen(false);
  };
  const handleAddButtonClick = (e: MouseEvent | KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains(styles.triangle) ||
      target.closest(`.${styles.triangle}`) ||
      target.classList.contains(styles.context_menu) ||
      target.closest(`.${styles.context_menu}`)
    ) {
      return;
    }
    openModal("createTradeRecord");
  };
  const toggleContextMenu = (): void => setIsContextMenuOpen((isOpen) => !isOpen);
  const toggleCollapsed = (): void => {
    const nextIsCollapsed = toggleMainNavCollapsed(isCollapsed);
    setIsCollapsed(nextIsCollapsed);
    saveMainNavCollapsed(nextIsCollapsed);
  };

  const showsIconOnly = isCollapsed && isWide;
  const collapseLabel = isCollapsed ? "展開側邊欄" : "收合側邊欄";
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
              <img src={avatarUrl} alt="" />
              <div className={styles.middle}>
                <div className={styles.username}>{username}</div>
                <div className={styles.hint}>查看帳號與設定</div>
              </div>
            </div>
          </NavLink>
        </WithTooltip>
        {isWide && (
          <Tooltip content={collapseLabel} side="right">
            <button
              type="button"
              className={styles.collapse_button}
              aria-expanded={!isCollapsed}
              aria-label={collapseLabel}
              onClick={toggleCollapsed}
            >
              <Icons.IconSidebar sideLength="16" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className={styles.subpage_list}>
        {subpages.map((subpage, idx) => {
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
            onClick={handleAddButtonClick}
            onKeyDown={(e) => {
              if (isActivationKey(e)) {
                e.preventDefault();
                handleAddButtonClick(e);
              }
            }}
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
              onClick={(e) => {
                e.stopPropagation();
                toggleContextMenu();
              }}
              onKeyDown={(e) => {
                if (isActivationKey(e)) {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleContextMenu();
                }
              }}
              role="button"
              tabIndex={0}
            ></div>
            {isContextMenuOpen && (
              <div className={styles.context_menu}>
                {CONTEXT_MENU_ITEMS.map(({ modalName, label }) => (
                  <div
                    key={modalName}
                    className={styles.context_menu_item}
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(modalName);
                    }}
                    onKeyDown={(e) => {
                      if (isActivationKey(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                        openModal(modalName);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.text}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </WithTooltip>
        <WithTooltip content="搜尋" enabled={showsIconOnly}>
          <div
            className={styles.action_button}
            onClick={() => openModal("search")}
            onKeyDown={(e) => {
              if (isActivationKey(e)) {
                e.preventDefault();
                openModal("search");
              }
            }}
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
      {activeModalName && (
        <AddOrSearchModal
          modalName={activeModalName}
          hideModal={() => setActiveModalName(null)}
        />
      )}
      <div className={styles.lower}>
        <div className={styles.logo_outer}>
          <FullLogo size="s" />
        </div>
        <div className={styles.copyright}>© Taigu 2021-{new Date().getFullYear()}</div>
      </div>
    </div>
  );
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

export default memo(MainSideBar);
