import React from "react";
import { connect } from "react-redux";

import googleLogo from "../../../assets/google.png";
import {
  BeautifulBlock,
  BeautifulRow,
  BottomSheet,
  Button,
  FullLogo,
  LabeledInputV2,
  Modal,
} from "../../../components";
import { IconLink } from "../../../icons";
import { changeAccountBinding } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import Api from "../../../utils/api";
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
              title="更換綁定的帳號"
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
        <div className={styles.main}>
          <div className={styles.logo_container}>
            <FullLogo size="l" />
            <IconLink sideLength="16px" color="gray" />
            <img className={styles.google_logo} src={googleLogo} alt="" />
          </div>
          <BeautifulBlock>
            <LabeledInputV2
              title="綁定的帳號"
              type="text"
              value={this.props.email}
              disabled
            />
            <BeautifulRow
              onClick={this.props.isWaiting ? undefined : this.handleClickChangeBinding}
            >
              <div className={styles.beautiful_row_content}>
                {this.props.isWaiting ? "處理中..." : "更換綁定的帳號"}
              </div>
            </BeautifulRow>
          </BeautifulBlock>
        </div>
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
