import React, {
  type CSSProperties,
  KeyboardEvent,
  memo,
  MouseEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NavLink } from "react-router-dom";

import { FullLogo, NavTab, Tooltip } from "../../components";
import * as Icons from "../../icons";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import { mainTabNavigationState } from "../../utils/mainNavigation";
import { makeWidthAtLeastQuery, useMediaQuery } from "../../utils/mediaQuery";
import { settingsPagePath } from "../../utils/router";
import { useLatestRef } from "../../utils/useLatestRef";
import type { AddOrSearchModalName } from "../AddOrSearchModal/AddOrSearchModal";
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
  onOpenModal: (_modalName: AddOrSearchModalName) => void;
}

// Below this width the sidebar is the icon rail of NAV-R2, which cannot be expanded.
const EXPANDABLE_WIDTH_QUERY = makeWidthAtLeastQuery("lg");

// The gap between the add button on the icon rail and the menu that opens below it,
// clear of the button's tooltip on its right.
const RAIL_MENU_OFFSET_PX = 4;

const CONTEXT_MENU_ITEMS: { modalName: AddOrSearchModalName; label: string }[] = [
  { modalName: "createTradeRecord", label: "新增交易紀錄" },
  { modalName: "createCashDividendRecord", label: "新增現金股利" },
  { modalName: "createTradePlan", label: "新增買賣計畫" },
];

function isActivationKey(e: KeyboardEvent): boolean {
  return e.key === "Enter" || e.key === " ";
}

function MainSideBar({ avatarUrl, username, subpages, onOpenModal }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(isMainNavCollapsedInStorage);
  const isExpandable = useMediaQuery(EXPANDABLE_WIDTH_QUERY);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  // The icon rail scrolls its overflow, which would clip a menu wider than the rail, so
  // the menu is fixed to the viewport at the add button.
  const [railMenuStyle, setRailMenuStyle] = useState<CSSProperties | undefined>();
  const addButtonRef = useRef<HTMLDivElement>(null);
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
    const handleDocumentKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== "Escape" || !isContextMenuOpenRef.current) return;
      setIsContextMenuOpen(false);
      addButtonRef.current?.focus();
    };
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isContextMenuOpenRef]);

  const showsIconOnly = isCollapsed || !isExpandable;
  const [menuShowsIconOnly, setMenuShowsIconOnly] = useState(showsIconOnly);
  if (menuShowsIconOnly !== showsIconOnly) {
    // The open menu is placed for the sidebar it opened in.
    setMenuShowsIconOnly(showsIconOnly);
    setIsContextMenuOpen(false);
  }

  const openModal = (modalName: AddOrSearchModalName): void => {
    onOpenModal(modalName);
    setIsContextMenuOpen(false);
  };
  const toggleContextMenu = (): void => {
    const addButtonRect = addButtonRef.current?.getBoundingClientRect();
    setRailMenuStyle(
      showsIconOnly && addButtonRect
        ? { top: addButtonRect.bottom + RAIL_MENU_OFFSET_PX, left: addButtonRect.left }
        : undefined,
    );
    setIsContextMenuOpen((isOpen) => !isOpen);
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
    // The icon rail has no room for the menu button beside 「新增」 (REC-R10).
    if (showsIconOnly) toggleContextMenu();
    else openModal("createTradeRecord");
  };
  const toggleCollapsed = (): void => {
    const nextIsCollapsed = toggleMainNavCollapsed(isCollapsed);
    setIsCollapsed(nextIsCollapsed);
    saveMainNavCollapsed(nextIsCollapsed);
  };

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
        {isExpandable && (
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
            ref={addButtonRef}
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
            aria-expanded={showsIconOnly ? isContextMenuOpen : undefined}
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
              <div
                className={`${styles.context_menu} ${
                  railMenuStyle ? styles.rail_menu : ""
                }`}
                style={railMenuStyle}
              >
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
