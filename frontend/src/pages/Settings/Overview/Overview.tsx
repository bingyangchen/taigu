import googleLogo from "../../../assets/google.png";
import logo from "../../../assets/logo.png";
import imgPersonFill from "../../../assets/person-fill.svg";
import styles from "./Overview.module.scss";

import React from "react";
import { connect } from "react-redux";

import {
  BeautifulBlock,
  BeautifulRow,
  Modal,
  NavBarForSettings,
} from "../../../components";
import {
  IconEnvelope,
  IconExit,
  IconIncognito,
  IconInfoCircle,
  IconPersonVcard,
  IconTermsInfo,
  IconUser,
} from "../../../icons";
import { logout } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import type { Subpage } from "../../../types";
import Env from "../../../utils/env";
import Nav from "../../../utils/nav";
import Util from "../../../utils/util";

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
      {
        icon: <IconPersonVcard sideLength="100%" />,
        name: "基本資訊",
        path: "#basic-info",
      },
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
      {
        icon: <IconInfoCircle sideLength="100%" />,
        name: "關於",
        path: "#about",
      },
      {
        icon: <IconUser sideLength="100%" />,
        name: "帳號",
        path: "#account",
      },
    ];
  }
  public componentDidMount(): void {
    this.props.dispatch(updateHeaderTitle("Settings"));
  }
  public render(): React.ReactNode {
    return (
      <>
        {this.state.activeModalName === "checkLogout" && (
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
        )}
        <div className={styles.main}>
          {!Util.isMobile && <NavBarForSettings subpages={this.subpages} />}
          <div className={styles.body}>
            <div id="basic-info" className={styles.section}>
              <BeautifulBlock title="基本資訊">
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
                        src={this.props.avatar_url || imgPersonFill}
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
              </BeautifulBlock>
            </div>
            {/* <div id="billing-and-plans" className={styles.section}>
              <BeautifulBlock title="付款與方案">
                <BeautifulRow
                  label="目前方案"
                  onClick={() =>
                    this.props.router.navigate(
                      `${Env.frontendRootPath}${settingsPagePath}/current-plan`
                    )
                  }
                >
                  Premium
                </BeautifulRow>
                <BeautifulRow
                  label="付款資訊"
                  onClick={() =>
                    this.props.router.navigate(
                      `${Env.frontendRootPath}${settingsPagePath}/payment-information`
                    )
                  }
                >
                  無
                </BeautifulRow>
              </BeautifulBlock>
            </div>
            <div id="notification" className={styles.section}>
              <BeautifulBlock title="通知">
                <BeautifulRow
                  label="交易通知"
                  onClick={() =>
                    this.props.router.navigate(
                      `${Env.frontendRootPath}${settingsPagePath}/notification`
                    )
                  }
                >
                  當商品價格觸及你的目標價格時，發送通知給你
                </BeautifulRow>
              </BeautifulBlock>
            </div> */}
            <div id="about" className={styles.section}>
              <BeautifulBlock title="關於">
                <BeautifulRow
                  onClick={() =>
                    window.open(`${Env.frontendRootPath}privacy-policy`, "_blank")
                  }
                >
                  <div className={`${styles.row_inner} ${styles.privacy_policy}`}>
                    <IconIncognito sideLength="16px" />
                    隱私權政策
                  </div>
                </BeautifulRow>
                <BeautifulRow
                  onClick={() =>
                    window.open(`${Env.frontendRootPath}terms-of-service`, "_blank")
                  }
                >
                  <div className={`${styles.row_inner} ${styles.terms_of_service}`}>
                    <IconTermsInfo sideLength="16px" />
                    服務條款
                  </div>
                </BeautifulRow>
              </BeautifulBlock>
            </div>
            <div id="account" className={styles.section}>
              <BeautifulBlock title="帳號">
                <BeautifulRow
                  onClick={() => {
                    this.setState({ activeModalName: "checkLogout" });
                  }}
                >
                  <div className={`${styles.row_inner} ${styles.logout}`}>
                    <IconExit sideLength="16px" />
                    登出
                  </div>
                  {/* <Button
                  className="dangerous border p8-15"
                  onClick={() =>
                    this.props.router.navigate(
                      `${Env.frontendRootPath}${settingsPagePath}/delete-account`
                    )
                  }
                >
                  永久刪除帳號
                </Button> */}
                </BeautifulRow>
              </BeautifulBlock>
            </div>
            <div className={styles.logo_container}>
              <img src={logo} alt="Taigu" className={styles.logo} />
            </div>
            <div className={styles.copyright}>
              Copyright {new Date().getFullYear()} Taigu All rights reserved.
            </div>
          </div>
        </div>
      </>
    );
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
