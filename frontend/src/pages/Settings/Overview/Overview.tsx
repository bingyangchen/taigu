import React from "react";
import { connect } from "react-redux";

import googleLogo from "../../../assets/google.png";
import imgPersonFill from "../../../assets/person-fill.svg";
import { BeautifulBlock, BeautifulRow, FullLogo, Modal } from "../../../components";
import * as Icons from "../../../icons";
import { logout } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";
import { getHideModalCallback } from "../../../utils/modal";
import Nav from "../../../utils/nav";
import Util from "../../../utils/util";
import { IssueReportEditor } from "../IssueReport/IssueReport";
import styles from "./Overview.module.scss";

function mapStateToProps(rootState: RootState) {
  const { email, username, avatar_url, isWaiting, subscription } = rootState.account;
  return { email, username, avatar_url, isWaiting, subscription };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}
interface State {
  activeModalName: "checkLogout" | "issueReport" | null;
  showDefaultAvatar: boolean;
}

class Overview extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { activeModalName: null, showDefaultAvatar: false };
  }
  public componentDidMount(): void {
    this.props.dispatch(updateHeaderTitle("設定"));
  }
  public render(): React.ReactNode {
    return (
      <>
        {this.activeModal}
        <div className={styles.main}>
          <BeautifulBlock id="account" title="帳號">
            <BeautifulRow
              onClick={() =>
                this.props.router.navigate(
                  `${Env.frontendRootPath}${settingsPagePath}/user-info`,
                )
              }
            >
              <div className={`${styles.row_inner} ${styles.user_info}`}>
                <div className={styles.avatar_container}>
                  <img
                    className={styles.avatar}
                    src={
                      this.state.showDefaultAvatar
                        ? imgPersonFill
                        : (Util.validateAndSanitizeUrl(this.props.avatar_url ?? "") ??
                          imgPersonFill)
                    }
                    alt=""
                    onError={() => this.setState({ showDefaultAvatar: true })}
                  />
                </div>
                <div className={styles.username}>{this.props.username}</div>
              </div>
            </BeautifulRow>
            <BeautifulRow
              onClick={() =>
                this.props.router.navigate(
                  `${Env.frontendRootPath}${settingsPagePath}/account-binding`,
                )
              }
            >
              <div className={`${styles.row_inner} ${styles.email}`}>
                <Icons.IconEnvelope sideLength="16px" />
                <div className={styles.email_container}>
                  <div>Email</div>
                  <div>{this.props.email}</div>
                </div>
                <img src={googleLogo} alt="" className={styles.google_logo} />
              </div>
            </BeautifulRow>
            <BeautifulRow
              onClick={() =>
                this.props.router.navigate(
                  `${Env.frontendRootPath}${settingsPagePath}/data-controls`,
                )
              }
            >
              <div className={`${styles.row_inner} ${styles.terms_of_service}`}>
                <Icons.IconDatabaseManagement sideLength="16px" />
                資料控制
              </div>
            </BeautifulRow>
          </BeautifulBlock>
          <BeautifulBlock id="billing-and-plans" title="付款與方案">
            <BeautifulRow
              label="目前方案"
              onClick={() =>
                this.props.router.navigate(
                  `${Env.frontendRootPath}${settingsPagePath}/current-plan`,
                )
              }
            >
              {this.props.subscription.plan === "standard" ? "Standard" : "Free"}
            </BeautifulRow>
          </BeautifulBlock>
          <BeautifulBlock id="about" title="關於">
            <BeautifulRow
              onClick={() =>
                window.open(
                  `${Env.frontendRootPath}privacy-policy`,
                  Util.isMobile ? "_self" : "_blank",
                )
              }
            >
              <div className={`${styles.row_inner} ${styles.privacy_policy}`}>
                <Icons.IconIncognito sideLength="16px" />
                隱私權政策
              </div>
            </BeautifulRow>
            <BeautifulRow
              onClick={() =>
                window.open(
                  `${Env.frontendRootPath}terms-of-service`,
                  Util.isMobile ? "_self" : "_blank",
                )
              }
            >
              <div className={`${styles.row_inner} ${styles.terms_of_service}`}>
                <Icons.IconTermsInfo sideLength="16px" />
                服務條款
              </div>
            </BeautifulRow>
            <BeautifulRow onClick={this.handleClickIssueReport}>
              <div className={`${styles.row_inner} ${styles.issue_report}`}>
                <Icons.IconExclamation sideLength="16px" />
                問題回報
              </div>
            </BeautifulRow>
          </BeautifulBlock>
          <BeautifulBlock id="logout">
            <BeautifulRow
              onClick={() => {
                this.setState({ activeModalName: "checkLogout" });
              }}
            >
              <div className={`${styles.row_inner} ${styles.logout}`}>
                <Icons.IconExit sideLength="16px" />
                登出
              </div>
            </BeautifulRow>
          </BeautifulBlock>
          <div className={styles.copyright}>
            <FullLogo size="m" />
            Copyright {new Date().getFullYear()} Taigu All rights reserved.
          </div>
        </div>
      </>
    );
  }
  private handleClickIssueReport = (): void => {
    if (Util.isMobile) {
      this.props.router.navigate(
        `${Env.frontendRootPath}${settingsPagePath}/issue-report`,
      );
      return;
    }
    this.setState({ activeModalName: "issueReport" });
  };

  private get activeModal(): React.ReactNode {
    if (this.state.activeModalName === "issueReport") {
      return <IssueReportEditor hideModal={getHideModalCallback(this)} />;
    }
    if (this.state.activeModalName === "checkLogout") {
      return (
        <Modal
          title="登出"
          discardButtonProps={{
            children: "取消",
            className: "transparent l",
            onClick: getHideModalCallback(this),
          }}
          submitButtonProps={{
            children: "登出",
            className: "primary l",
            disabled: this.props.isWaiting,
            waiting: this.props.isWaiting,
            onClick: this.handleClickCheckLogout,
          }}
        >
          確定要登出嗎？
        </Modal>
      );
    }
    return null;
  }

  private handleClickCheckLogout = async (): Promise<void> => {
    await this.props.dispatch(logout()).unwrap();
    if (Nav.isAtLoginPage) return;
    this.props.router.navigate(`${Env.frontendRootPath}login`, { replace: true });

    // Push one more state because Modal will do navigate(-1) after submitting.
    window.history.pushState({}, "", `${Env.frontendRootPath}login`);
  };
}

export default connect(mapStateToProps)(withRouter(Overview));
