import React from "react";
import { connect } from "react-redux";

import imgPersonFill from "../../../assets/person-fill.svg";
import { Button, Form, LabeledInput } from "../../../components";
import { updateAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./UserInfo.module.scss";

function mapStateToProps(rootState: RootState) {
  const { avatar_url, username, isWaiting } = rootState.account;
  return { avatar_url, username, isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  showDefaultAvatar: boolean;
  avatarUrl: string;
  username: string;
}

class UserInfo extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { showDefaultAvatar: false, avatarUrl: "", username: "" };
  }

  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("頭像與名字"));
    this.setState({
      avatarUrl: this.props.avatar_url ?? "",
      username: this.props.username,
    });
  }

  public async componentDidUpdate(prevProps: Readonly<Props>): Promise<void> {
    if (prevProps.username !== this.props.username) {
      this.setState({ username: this.props.username });
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
          <LabeledInput
            title="頭像 URL"
            type="text"
            value={this.state.avatarUrl || ""}
            onChange={(avatarUrl: string) => {
              this.setState({ avatarUrl: avatarUrl, showDefaultAvatar: false });
            }}
            autoFocus
          />
          <LabeledInput
            title="名字"
            type="text"
            value={this.state.username}
            onChange={(username: string) => this.setState({ username: username })}
          />
        </Form>
      </div>
    );
  }

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
