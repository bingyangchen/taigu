import React from "react";
import { connect } from "react-redux";

import googleLogo from "../../../assets/google.png";
import imgPersonFill from "../../../assets/person-fill.svg";
import { BeautifulBlock, BeautifulRow, FullLogo, Modal } from "../../../components";
import {
  IconDatabaseManagement,
  IconEnvelope,
  IconExclamation,
  IconExit,
  IconIncognito,
  IconInfoCircle,
  IconPersonVcard,
  IconTermsInfo,
} from "../../../icons";
import { logout } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import type { Subpage } from "../../../types";
import Env from "../../../utils/env";
import Nav from "../../../utils/nav";
import Util from "../../../utils/util";
import styles from "./Overview.module.scss";

function mapStateToProps(rootState: RootState) {
  const { email, username, avatar_url, isWaiting } = rootState.account;
  return { email, username, avatar_url, isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}
interface State {
  activeModalName: "checkLogout" | null;
}

class Overview extends React.Component<Props, State> {
  public state: State;
  private subpages: Subpage[];
  public constructor(props: Props) {
    super(props);
    this.state = { activeModalName: null };
    this.subpages = [
      { icon: <IconPersonVcard sideLength="100%" />, name: "帳號", path: "#account" },
      // {
      //     icon: <IconCreditCard sideLength="100%" />,
      //     name: "付款與方案",
      //     path: "#billing-and-plans",
      // },
      // {
      //     icon: <IconBell sideLength="100%" />,
      //     name: "通知",
      //     path: "#notification",
      // },
      { icon: <IconInfoCircle sideLength="100%" />, name: "關於", path: "#about" },
    ];
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
                    src={this.props.avatar_url ?? imgPersonFill}
                    alt=""
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
                <IconEnvelope sideLength="16px" />
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
                <IconDatabaseManagement sideLength="16px" />
                資料控制
              </div>
            </BeautifulRow>
          </BeautifulBlock>
          {/* <BeautifulBlock id="billing-and-plans" title="付款與方案">
              <BeautifulRow
                label="目前方案"
                onClick={() =>
                  this.props.router.navigate(
                    `${Env.frontendRootPath}${settingsPagePath}/current-plan`,
                  )
                }
              >
                Premium
              </BeautifulRow>
              <BeautifulRow
                label="付款資訊"
                onClick={() =>
                  this.props.router.navigate(
                    `${Env.frontendRootPath}${settingsPagePath}/payment-information`,
                  )
                }
              >
                無
              </BeautifulRow>
            </BeautifulBlock>
            <BeautifulBlock id="notification" title="通知">
              <BeautifulRow
                label="交易通知"
                onClick={() =>
                  this.props.router.navigate(
                    `${Env.frontendRootPath}${settingsPagePath}/notification`,
                  )
                }
              >
                當商品價格觸及你的目標價格時，發送通知給你
              </BeautifulRow>
            </BeautifulBlock> */}
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
                <IconIncognito sideLength="16px" />
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
                <IconTermsInfo sideLength="16px" />
                服務條款
              </div>
            </BeautifulRow>
            <BeautifulRow
              onClick={() =>
                window.open(
                  "https://github.com/bingyangchen/taigu/issues",
                  Util.isMobile ? "_self" : "_blank",
                )
              }
            >
              <div className={`${styles.row_inner} ${styles.issue_report}`}>
                <IconExclamation sideLength="16px" />
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
                <IconExit sideLength="16px" />
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
  private get activeModal(): React.ReactElement<typeof Modal> | null {
    if (this.state.activeModalName === "checkLogout") {
      return (
        <Modal
          title="登出"
          discardButtonProps={{
            children: "取消",
            className: "transparent l",
            onClick: Util.getHideModalCallback(this),
          }}
          submitButtonProps={{
            children: "登出",
            className: "primary l",
            disabled: this.props.isWaiting,
            waiting: this.props.isWaiting,
            onClick: this.handleClickCheckLogout,
          }}
          noX
          silentBackground
        >
          您確定要登出嗎？
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
