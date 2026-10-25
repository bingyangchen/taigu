import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  FullLogo,
  LoadingScreen,
  PageMeta,
  ToastList,
  Tooltip,
} from "../../components";
import * as Icons from "../../icons";
import { useAppDispatch } from "../../redux/hooks";
import { fetchAccountInfo } from "../../redux/slices/AccountSlice";
import { adminPagePath } from "../../router";
import Api from "../../utils/api";
import Env from "../../utils/env";
import NotFound from "../NotFound/NotFound";
import { isNotFound, LostAccessContext } from "./access";
import styles from "./Admin.module.scss";
import { LoadFailure } from "./components";
import IssueReports from "./IssueReports/IssueReports";
import Subscriptions from "./Subscriptions/Subscriptions";
import tokens from "./tokens.module.scss";
import Usage from "./Usage/Usage";

type Access = "checking" | "allowed" | "denied" | "failed";

const NAV_COLLAPSED_STORAGE_KEY = "admin-nav-collapsed";
const NARROW_MEDIA_QUERY = `(max-width: ${tokens.width780})`;

// Absolute, because relative links inside the `admin/*` splat route resolve
// against the whole current URL, so "usage" on /admin/subscriptions would lead
// to /admin/subscriptions/usage.
const ADMIN_PATH = `${Env.frontendRootPath}${adminPagePath}`;

const NAV_ITEMS = [
  { path: "usage", label: "使用情況", Icon: Icons.IconChartHistogram },
  { path: "subscriptions", label: "訂閱", Icon: Icons.IconCreditCard },
  { path: "issue-reports", label: "問題回報", Icon: Icons.IconExclamation },
] as const;

export default function Admin(): React.ReactElement {
  const dispatch = useAppDispatch();
  const [access, setAccess] = useState<Access>("checking");
  const [unhandledCount, setUnhandledCount] = useState<number | null>(null);
  const location = useLocation();
  const checkedPathname = useRef<string | null>(null);

  // Bumped by every count update, so a slower, older refetch cannot overwrite
  // the count that a mark returned.
  const unhandledCountVersion = useRef(0);

  const updateUnhandledCount = useCallback((count: number): void => {
    unhandledCountVersion.current += 1;
    setUnhandledCount(count);
  }, []);

  const checkAccess = useCallback(async (): Promise<void> => {
    setAccess("checking");
    checkedPathname.current = window.location.pathname;
    try {
      const account = await dispatch(fetchAccountInfo()).unwrap();
      if (!account) return;
      setAccess(account.is_superuser ? "allowed" : "denied");
    } catch {
      setAccess("failed");
    }
  }, [dispatch]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (access !== "allowed" || checkedPathname.current === location.pathname) return;
    checkedPathname.current = location.pathname;

    // Fetching the account on each page change also updates the recorded
    // subscription status (ADMIN-R10). A failure leaves the open page as it is.
    dispatch(fetchAccountInfo())
      .unwrap()
      .then((account) => {
        if (account && !account.is_superuser) setAccess("denied");
      })
      .catch(() => undefined);
  }, [access, location.pathname, dispatch]);

  // Refetched on each page change, so reports sent meanwhile are counted.
  useEffect(() => {
    if (access !== "allowed") return;
    const version = ++unhandledCountVersion.current;
    Api.sendRequest("admin/issue-reports/unhandled-count", "get", undefined, {
      redirectOnNotFound: false,
    })
      .then((response?: { count: number }) => {
        if (response && version === unhandledCountVersion.current) {
          setUnhandledCount(response.count);
        }
      })
      .catch((error) => {
        if (isNotFound(error)) setAccess("denied");

        // Otherwise the count is a hint in the nav, so it keeps the last one.
      });
  }, [access, location.pathname]);

  const denyAccess = useCallback((): void => setAccess("denied"), []);

  if (access === "checking") return <LoadingScreen />;
  if (access === "denied") return <NotFound />;
  if (access === "failed") {
    return (
      <main className={styles.access_failure}>
        <LoadFailure onRetry={checkAccess} />
      </main>
    );
  }
  return (
    <LostAccessContext.Provider value={denyAccess}>
      <Routes>
        <Route element={<AdminShell unhandledCount={unhandledCount} />}>
          <Route index element={<Navigate to={`${ADMIN_PATH}/usage`} replace />} />
          <Route path="usage" element={<Usage />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route
            path="issue-reports"
            element={<IssueReports onUnhandledCountChange={updateUnhandledCount} />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LostAccessContext.Provider>
  );
}

function AdminShell({
  unhandledCount,
}: {
  unhandledCount: number | null;
}): React.ReactElement {
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const isNarrow = useMediaQuery(NARROW_MEDIA_QUERY);
  const [isCollapsed, setIsCollapsed] = useState(isNavCollapsedInStorage);
  const showsIconOnly = isCollapsed && !isNarrow;

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  const toggleCollapsed = (): void => {
    const nextIsCollapsed = !isCollapsed;
    setIsCollapsed(nextIsCollapsed);
    try {
      window.localStorage.setItem(
        NAV_COLLAPSED_STORAGE_KEY,
        nextIsCollapsed ? "1" : "0",
      );
    } catch {
      // Without storage, the sidebar opens expanded next time.
    }
  };
  const collapseLabel = isCollapsed ? "展開側邊欄" : "收合側邊欄";

  return (
    <div className={`${styles.shell} ${isCollapsed ? styles.collapsed : ""}`}>
      <PageMeta title="後台 | Taigu" noindex />
      <ToastList />
      <nav className={styles.nav} aria-label="後台">
        <div className={styles.nav_top}>
          <div className={styles.nav_brand}>
            <FullLogo size="s" />
            <span>後台</span>
          </div>
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
        </div>
        <div className={styles.nav_items}>
          {NAV_ITEMS.map(({ path, label, Icon }) => (
            <WithTooltip key={path} content={label} enabled={showsIconOnly}>
              <NavLink className={styles.nav_item} to={`${ADMIN_PATH}/${path}`}>
                <Icon sideLength="16" />
                <span className={styles.nav_label}>{label}</span>
                {path === "issue-reports" && !!unhandledCount && (
                  <span className={styles.badge}>
                    <span aria-hidden="true">{unhandledCount}</span>
                    <VisuallyHidden.Root>
                      ，未處理 {unhandledCount} 則
                    </VisuallyHidden.Root>
                  </span>
                )}
              </NavLink>
            </WithTooltip>
          ))}
        </div>
        <WithTooltip
          content="回到 Taigu"
          enabled={showsIconOnly || isNarrow}
          side={isNarrow ? "bottom" : "right"}
        >
          <Link
            className={`${styles.nav_item} ${styles.back_link}`}
            to={Env.frontendRootPath}
          >
            <Icons.IconHome sideLength="16" />
            <span className={styles.nav_label}>回到 Taigu</span>
          </Link>
        </WithTooltip>
      </nav>
      <main className={styles.content} ref={contentRef}>
        <div className={styles.content_inner}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function WithTooltip({
  content,
  enabled,
  side = "right",
  children,
}: {
  content: string;
  enabled: boolean;
  side?: "right" | "bottom";
  children: React.ReactElement;
}): React.ReactElement {
  return enabled ? (
    <Tooltip content={content} side={side}>
      {children}
    </Tooltip>
  ) : (
    children
  );
}

function isNavCollapsedInStorage(): boolean {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = (): void => setMatches(mediaQueryList.matches);
    handleChange();
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);
  return matches;
}
