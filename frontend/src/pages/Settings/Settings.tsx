import React from "react";
import { connect } from "react-redux";
import { Outlet } from "react-router-dom";

import { HeaderForSettings, PageMeta, ToastList } from "../../components";
import { fetchAccountInfo, openSession } from "../../redux/slices/AccountSlice";
import type { AppDispatch } from "../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../router";
import Env from "../../utils/env";
import { getMainTabPath, isSameUrlHistoryTraversal } from "../../utils/mainNavigation";
import Util from "../../utils/util";
import {
  captureViewPosition,
  getViewHistory,
  type ViewPosition,
} from "../Main/viewHistory";
import styles from "./Settings.module.scss";

interface Props extends IRouter {
  dispatch: AppDispatch;
}
interface State {
  prevLocationPathname: string | null;
}

class Settings extends React.Component<Props, State> {
  public state: State;
  private readonly mainRef = React.createRef<HTMLElement>();
  private readonly viewHistory = getViewHistory();
  private removePageReturnListener: (() => void) | null = null;
  public constructor(props: Props) {
    super(props);
    this.state = { prevLocationPathname: null };
  }

  public async componentDidMount(): Promise<void> {
    document.body.classList.toggle("settings-page-document-scroll", Util.isMobile);
    this.restoreOverviewPosition();
    this.props.dispatch(fetchAccountInfo());
    this.props.dispatch(openSession());
    this.removePageReturnListener = Util.addPageReturnListener(() =>
      this.props.dispatch(openSession()),
    );
  }

  public getSnapshotBeforeUpdate(prevProps: Readonly<Props>): ViewPosition | null {
    const { location } = prevProps.router;
    return location.key !== this.props.router.location.key && getMainTabPath(location)
      ? this.captureOverviewPosition()
      : null;
  }

  public componentDidUpdate(
    prevProps: Readonly<Props>,
    _prevState: Readonly<State>,
    position: ViewPosition | null,
  ): void {
    if (position) this.viewHistory.save(prevProps.router.location, { position });
    const previousLocation = prevProps.router.location;
    const { location, navigationType } = this.props.router;
    const sameOverviewTraversal =
      getMainTabPath(location) &&
      isSameUrlHistoryTraversal(previousLocation, location, navigationType);
    if (previousLocation.pathname !== location.pathname) {
      this.restoreOverviewPosition();
      this.props.dispatch(openSession());
    } else if (sameOverviewTraversal) this.restoreOverviewPosition();

    // Conditionally navigate back one more time
    if (prevProps.router.location.key !== this.props.router.location.key) {
      if (
        !sameOverviewTraversal &&
        prevProps.router.location.pathname === this.props.router.location.pathname &&
        prevProps.router.location.hash === this.props.router.location.hash &&
        prevProps.router.location.search === this.props.router.location.search &&
        prevProps.router.location.state === this.props.router.location.state
      ) {
        this.setState(
          { prevLocationPathname: prevProps.router.location.pathname },
          () => this.props.router.navigate(-1),
        );
      } else this.setState({ prevLocationPathname: null });
    }
  }

  public componentWillUnmount(): void {
    const { location } = this.props.router;
    if (getMainTabPath(location)) {
      const position = this.captureOverviewPosition();
      if (position) this.viewHistory.save(location, { position });
      window.history.scrollRestoration = "auto";
    }
    document.body.classList.remove("settings-page-document-scroll");
    this.removePageReturnListener?.();
  }

  public render(): React.ReactNode {
    return (
      <main
        ref={this.mainRef}
        className={`${styles.main} ${
          Util.isMobile && this.isSettingsEditorRoute ? styles.mobile_editor_shell : ""
        }`}
      >
        <PageMeta title="帳戶設定 | Taigu" noindex />
        <ToastList />
        <div className={styles.body}>
          {!this.isSettingsEditorRoute && <HeaderForSettings />}
          <Outlet />
        </div>
      </main>
    );
  }

  private getOverviewScrollContainer(): Window | HTMLElement | null {
    return Util.isMobile && window.matchMedia("(max-width: 779px)").matches
      ? window
      : this.mainRef.current;
  }

  private captureOverviewPosition(): ViewPosition | null {
    const container = this.getOverviewScrollContainer();
    return container ? captureViewPosition(container, null) : null;
  }

  private restoreOverviewPosition(): void {
    const { location, navigationType } = this.props.router;
    const isOverview = Boolean(getMainTabPath(location));
    window.history.scrollRestoration = isOverview ? "manual" : "auto";
    if (!isOverview) return;

    const position = this.viewHistory.get(location, navigationType)?.position;
    if (position || navigationType !== "POP") {
      this.getOverviewScrollContainer()?.scrollTo({ top: position?.top ?? 0, left: 0 });
    }
  }

  private get isSettingsEditorRoute(): boolean {
    const issueReportPath =
      `${Env.frontendRootPath}${settingsPagePath}/issue-report`.replace(/\/+/g, "/");
    return this.props.router.location.pathname === issueReportPath;
  }
}

export default connect()(withRouter(Settings));
