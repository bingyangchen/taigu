import MD5 from "crypto-js/md5";
import React from "react";
import { connect } from "react-redux";

import imgPersonFill from "../../../assets/person-fill.svg";
import {
  BeautifulBlock,
  BottomSheet,
  Button,
  Form,
  LabeledInputV2,
  Modal,
} from "../../../components";
import { updateAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./UserInfo.module.scss";

function mapStateToProps(rootState: RootState) {
  const { avatar_url, username, email, isWaiting } = rootState.account;
  return { avatar_url, username, email, isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  showDefaultAvatar: boolean;
  validGravatarUrl: string | null;
  avatarUrl: string;
  username: string;
  activeModalName: "gravatar" | null;
  shouldBlinkAvatarInput: boolean;
}

class UserInfo extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {
      showDefaultAvatar: false,
      validGravatarUrl: null,
      avatarUrl: "",
      username: "",
      activeModalName: null,
      shouldBlinkAvatarInput: false,
    };
  }

  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("頭像與名字"));
    this.setState({
      avatarUrl: this.props.avatar_url ?? "",
      username: this.props.username,
    });
    this.checkIfGravatarExists();
  }

  public async componentDidUpdate(prevProps: Readonly<Props>): Promise<void> {
    if (prevProps.username !== this.props.username) {
      this.setState({ username: this.props.username });
    }
    if (prevProps.email !== this.props.email) {
      this.checkIfGravatarExists();
    }
    if (prevProps.avatar_url !== this.props.avatar_url) {
      this.setState({
        avatarUrl: this.props.avatar_url ?? "",
        showDefaultAvatar: false,
      });
    }
  }

  public render(): React.ReactNode {
    return (
      <>
        {this.state.activeModalName === "gravatar" &&
          (Util.isMobile ? (
            <BottomSheet onClickBackground={this.handleClickGravatarModalBackground}>
              <div className={styles.gravatar_modal_content}>
                <img
                  className={styles.gravatar_preview}
                  src={this.state.validGravatarUrl ?? imgPersonFill}
                  alt=""
                />
                <div className={styles.gravatar_bottom_sheet_buttons}>
                  <Button
                    className="primary_fill l round"
                    onClick={this.handleClickGravatarApply}
                  >
                    套用
                  </Button>
                  <Button
                    className="transparent l round"
                    onClick={this.handleClickGravatarDiscard}
                  >
                    捨棄
                  </Button>
                </div>
              </div>
            </BottomSheet>
          ) : (
            <Modal
              title="使用 Gravatar 頭像"
              discardButtonProps={{
                children: "捨棄",
                className: "light l",
                onClick: this.handleClickGravatarDiscard,
              }}
              submitButtonProps={{
                children: "套用",
                className: "primary_fill l",
                onClick: this.handleClickGravatarApply,
              }}
            >
              <div className={styles.gravatar_modal_content}>
                <img
                  className={styles.gravatar_preview}
                  src={this.state.validGravatarUrl ?? imgPersonFill}
                  alt=""
                />
              </div>
            </Modal>
          ))}
        <div className={styles.main}>
          <Form
            primaryFooterButton={
              <Button
                className="primary_fill l"
                disabled={this.props.isWaiting}
                waiting={this.props.isWaiting}
                onClick={this.handleClickSave}
              >
                儲存
              </Button>
            }
            secondaryFooterButton={
              <Button
                className="light l"
                onClick={() =>
                  this.props.router.navigate(
                    `${Env.frontendRootPath}${settingsPagePath}`,
                    { replace: true },
                  )
                }
              >
                捨棄
              </Button>
            }
          >
            <img
              className={styles.avatar_preview}
              src={
                this.state.showDefaultAvatar
                  ? imgPersonFill
                  : (Util.validateAndSanitizeUrl(this.state.avatarUrl) ?? imgPersonFill)
              }
              alt=""
              onError={() => this.setState({ showDefaultAvatar: true })}
            />
            {this.state.validGravatarUrl && (
              <button
                className={styles.gravatar_button}
                onClick={this.handleClickUseGravatar}
              >
                使用 Gravatar 頭像
              </button>
            )}
            <BeautifulBlock>
              <div className={styles.avatarInputWrapper}>
                {this.state.shouldBlinkAvatarInput && (
                  <div className={styles.blinkOverlay} />
                )}
                <LabeledInputV2
                  title="頭像位置"
                  type="text"
                  value={this.state.avatarUrl || ""}
                  onChange={(avatarUrl: string) => {
                    this.setState({ avatarUrl: avatarUrl, showDefaultAvatar: false });
                  }}
                  autoFocus
                />
              </div>
              <LabeledInputV2
                title="名字"
                type="text"
                value={this.state.username}
                onChange={(username: string) => this.setState({ username: username })}
              />
            </BeautifulBlock>
          </Form>
        </div>
      </>
    );
  }

  private checkIfGravatarExists = async (): Promise<void> => {
    if (this.props.email) {
      const emailHash = MD5(this.props.email.toLowerCase().trim()).toString();
      const url = `https://www.gravatar.com/avatar/${emailHash}?d=404&s=128`;
      const response = await fetch(url);
      if (response.ok) this.setState({ validGravatarUrl: url });
      else this.setState({ validGravatarUrl: null });
    }
  };

  private handleClickUseGravatar = async (): Promise<void> => {
    this.setState({ activeModalName: "gravatar" });
  };

  private handleClickGravatarModalBackground = (): void => {
    this.setState({ activeModalName: null });
  };

  private handleClickGravatarDiscard = (): void => {
    this.setState({ activeModalName: null });
  };

  private handleClickGravatarApply = (): void => {
    if (this.state.validGravatarUrl) {
      this.setState({
        avatarUrl: this.state.validGravatarUrl,
        activeModalName: null,
        showDefaultAvatar: false,
        shouldBlinkAvatarInput: true,
      });
      setTimeout(() => {
        this.setState({ shouldBlinkAvatarInput: false });
      }, 500);
    }
    if (this.props.router.location.hash === "#!") {
      this.props.router.navigate(-1); // remove the hash for the bottom sheet
    }
  };

  private handleClickSave = async (): Promise<void> => {
    const validatedAvatarUrl = Util.validateAndSanitizeUrl(this.state.avatarUrl);

    if (this.state.avatarUrl && !validatedAvatarUrl) {
      this.props.dispatch(
        pushToast({ type: "error", text: "無效的頭像 URL，請檢查格式是否正確" }),
      );
      return;
    }

    await this.props
      .dispatch(
        updateAccountInfo({
          avatar_url: validatedAvatarUrl ?? "",
          username: this.state.username,
        }),
      )
      .unwrap();
    this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
      replace: true,
    });
  };
}

export default connect(mapStateToProps)(withRouter(UserInfo));
