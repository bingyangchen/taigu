import React from "react";
import { connect } from "react-redux";
import { Outlet } from "react-router-dom";

import { HeaderForSettings, ToastList } from "../../components";
import { fetchAccountInfo } from "../../redux/slices/AccountSlice";
import type { AppDispatch } from "../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../router";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./Settings.module.scss";

interface Props extends IRouter {
  dispatch: AppDispatch;
}
interface State {
  prevLocationPathname: string | null;
}

class Settings extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { prevLocationPathname: null };
  }

  public async componentDidMount(): Promise<void> {
    document.body.classList.toggle("settings-page-document-scroll", Util.isMobile);
    this.props.dispatch(fetchAccountInfo());
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    // Conditionally navigate back one more time
    if (prevProps.router.location.key !== this.props.router.location.key) {
      if (
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
    document.body.classList.remove("settings-page-document-scroll");
  }

  public render(): React.ReactNode {
    return (
      <main
        className={`${styles.main} ${
          Util.isMobile && this.isSettingsEditorRoute ? styles.mobile_editor_shell : ""
        }`}
      >
        <ToastList />
        <div className={styles.body}>
          {!this.isSettingsEditorRoute && <HeaderForSettings />}
          <Outlet />
        </div>
      </main>
    );
  }

  private get isSettingsEditorRoute(): boolean {
    const issueReportPath =
      `${Env.frontendRootPath}${settingsPagePath}/issue-report`.replace(/\/+/g, "/");
    return this.props.router.location.pathname === issueReportPath;
  }
}

export default connect()(withRouter(Settings));
