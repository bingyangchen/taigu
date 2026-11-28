import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";

import {
  HeaderForSettings,
  OfflineNotice,
  PageMeta,
  ToastList,
} from "../../components";
import { useAppDispatch } from "../../redux/hooks";
import { fetchAccountInfo, openSession } from "../../redux/slices/AccountSlice";
import Env from "../../utils/env";
import { getMainTabPath, isSameUrlHistoryTraversal } from "../../utils/mainNavigation";
import { useIsNarrowLayout } from "../../utils/mediaQuery";
import { settingsPagePath } from "../../utils/router";
import { useLatestRef } from "../../utils/useLatestRef";
import Util from "../../utils/util";
import { captureViewPosition, getViewHistory } from "../Main/viewHistory";
import styles from "./Settings.module.scss";

function Settings() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [viewHistory] = useState(getViewHistory);
  const isNarrowLayout = useIsNarrowLayout();
  const latestRenderRef = useLatestRef({ location, navigationType });

  // Follows Settings.module.scss.
  const getOverviewScrollContainer = useCallback(
    (): Window | HTMLElement | null =>
      document.body.classList.contains("settings-page-document-scroll")
        ? window
        : mainRef.current,
    [],
  );
  const captureOverviewPosition = useCallback(() => {
    const container = getOverviewScrollContainer();
    return container ? captureViewPosition(container, null) : null;
  }, [getOverviewScrollContainer]);
  const restoreOverviewPosition = useCallback((): void => {
    const { location: latestLocation, navigationType: latestNavigationType } =
      latestRenderRef.current;
    const isOverview = Boolean(getMainTabPath(latestLocation));
    window.history.scrollRestoration = isOverview ? "manual" : "auto";
    if (!isOverview) return;

    const position = viewHistory.get(latestLocation, latestNavigationType)?.position;
    if (position || latestNavigationType !== "POP") {
      getOverviewScrollContainer()?.scrollTo({ top: position?.top ?? 0, left: 0 });
    }
  }, [getOverviewScrollContainer, latestRenderRef, viewHistory]);

  const saveOverviewPositionOnLeave = useCallback((): void => {
    const latestLocation = latestRenderRef.current.location;
    if (!getMainTabPath(latestLocation)) return;
    const position = captureOverviewPosition();
    if (position) viewHistory.save(latestLocation, { position });
    window.history.scrollRestoration = "auto";
  }, [captureOverviewPosition, latestRenderRef, viewHistory]);

  // Leaving the overview replaces its DOM, and no hook runs between the render and
  // that DOM update, so the render reads the overview's scroll position while the DOM
  // still shows it.
  const committedLocation = latestRenderRef.current.location;
  const overviewPositionBeforeNavigation =
    committedLocation.key !== location.key && getMainTabPath(committedLocation)
      ? captureOverviewPosition()
      : null;

  // Before the effect below restores the overview's position in the container it sets.
  useLayoutEffect(() => {
    document.body.classList.toggle("settings-page-document-scroll", isNarrowLayout);
  }, [isNarrowLayout]);

  useLayoutEffect(() => {
    restoreOverviewPosition();
    dispatch(fetchAccountInfo());
    dispatch(openSession());
    const removePageReturnListener = Util.addPageReturnListener(() =>
      dispatch(openSession()),
    );
    return () => {
      saveOverviewPositionOnLeave();
      document.body.classList.remove("settings-page-document-scroll");
      removePageReturnListener();
    };
  }, [dispatch, restoreOverviewPosition, saveOverviewPositionOnLeave]);

  useLayoutEffect(() => {
    const previousLocation = committedLocation;
    if (previousLocation.key === location.key) return;

    if (overviewPositionBeforeNavigation) {
      viewHistory.save(previousLocation, {
        position: overviewPositionBeforeNavigation,
      });
    }
    const sameOverviewTraversal =
      getMainTabPath(location) &&
      isSameUrlHistoryTraversal(previousLocation, location, navigationType);
    if (previousLocation.pathname !== location.pathname) {
      restoreOverviewPosition();
      dispatch(openSession());
    } else if (sameOverviewTraversal) restoreOverviewPosition();

    // Conditionally navigate back one more time
    if (
      !sameOverviewTraversal &&
      previousLocation.pathname === location.pathname &&
      previousLocation.hash === location.hash &&
      previousLocation.search === location.search &&
      previousLocation.state === location.state
    ) {
      navigate(-1);
    }
  }, [
    committedLocation,
    dispatch,
    location,
    navigate,
    navigationType,
    overviewPositionBeforeNavigation,
    restoreOverviewPosition,
    viewHistory,
  ]);

  const isSettingsEditorRoute =
    location.pathname ===
    `${Env.frontendRootPath}${settingsPagePath}/issue-report`.replace(/\/+/g, "/");
  return (
    <main
      ref={mainRef}
      className={`${styles.main} ${
        isSettingsEditorRoute ? styles.mobile_editor_shell : ""
      }`}
    >
      <PageMeta title="帳戶設定 | Taigu" noindex />
      <ToastList />
      <OfflineNotice narrowPlacement="bottom" />
      <div className={styles.body}>
        {!isSettingsEditorRoute && <HeaderForSettings />}
        <Outlet />
      </div>
    </main>
  );
}

export default memo(Settings);
