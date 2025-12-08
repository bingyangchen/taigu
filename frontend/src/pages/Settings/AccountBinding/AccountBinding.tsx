import React from "react";
import { connect } from "react-redux";

import googleLogo from "../../../assets/google.png";
import logo from "../../../assets/logo.png";
import { BottomSheet, Button, Modal } from "../../../components";
import Form from "../../../components/Form/Form";
import { IconLink } from "../../../icons";
import { changeAccountBinding } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Api from "../../../utils/api";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./AccountBinding.module.scss";

function mapStateToProps(rootState: RootState) {
  const { email, isWaiting } = rootState.account;
  return { email, isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  activeModalName: "changeBinding" | null;
}

class AccountBinding extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { activeModalName: null };
  }
  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("帳號綁定"));
    if (this.props.router.search_params.get("code")) {
      try {
        const requestBody = new URLSearchParams();
        requestBody.append(
          "code",
          this.props.router.search_params.get("code") as string,
        );
        requestBody.append(
          "redirect_uri",
          `${window.location.origin}/settings/account-binding`,
        );
        await this.props.dispatch(changeAccountBinding(requestBody)).unwrap();
      } finally {
        const currentUrl = new URL(window.location.href);
        currentUrl.search = "";
        window.history.replaceState({}, "", currentUrl.href);
      }
    }
  }
  public render(): React.ReactNode {
    return (
      <>
        {this.state.activeModalName === "changeBinding" &&
          (Util.isMobile ? (
            <BottomSheet onClickBackground={this.handleClickBottomSheetBackground}>
              <div
                className={styles.bottom_sheet_row}
                onClick={this.handleClickGoogleLogin}
              >
                <img className={styles.google_logo} src={googleLogo} alt="" />
                {!this.props.isWaiting && "綁定 Google 帳號"}
              </div>
            </BottomSheet>
          ) : (
            <Modal
              title="綁定其它帳號"
              noFooter
              discardButtonProps={{
                children: null,
                className: "",
                onClick: Util.getHideModalCallback(this),
              }}
            >
              <div className={styles.model_body}>
                <Button
                  className="white border l"
                  disabled={this.props.isWaiting}
                  waiting={this.props.isWaiting}
                  onClick={this.handleClickGoogleLogin}
                >
                  <img className={styles.google_logo} src={googleLogo} alt="" />
                  {!this.props.isWaiting && "綁定 Google 帳號"}
                </Button>
              </div>
            </Modal>
          ))}
        <Form
          title="帳號綁定"
          goBackHandler={() => {
            this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
              replace: true,
            });
          }}
          primaryFooterButton={
            <Button
              className="primary l border"
              disabled={this.props.isWaiting}
              waiting={this.props.isWaiting}
              onClick={this.handleClickChangeBinding}
            >
              綁定其它帳號
            </Button>
          }
        >
          <div className={styles.logo_container}>
            <img className={styles.logo} src={logo} alt="" />
            <IconLink sideLength="16px" color="gray" />
            <img className={styles.google_logo} src={googleLogo} alt="" />
          </div>
          <div className={styles.email_container}>
            <div className={styles.email_title}>綁定的帳號</div>
            <div className={styles.email_content}>{this.props.email}</div>
          </div>
        </Form>
      </>
    );
  }
  private handleClickChangeBinding = async (): Promise<void> => {
    this.setState({ activeModalName: "changeBinding" });
  };
  private handleClickBottomSheetBackground = (): void => {
    this.setState({ activeModalName: null });
  };
  private handleClickGoogleLogin = async () => {
    this.setState({ activeModalName: null });
    const response = await Api.sendRequest(
      `account/authorization-url?redirect_uri=${window.location.origin}/settings/account-binding`,
      "get",
    );
    window.location = response.authorization_url;
  };
}

export default connect(mapStateToProps)(withRouter(AccountBinding));
