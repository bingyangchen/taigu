import imgPersonFill from "../../../assets/person-fill.svg";
import styles from "./UserInfo.module.scss";

import React from "react";
import { connect } from "react-redux";

import { Button, Form, LabeledInput } from "../../../components";
import { updateAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";

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
    this.props.dispatch(updateHeaderTitle("頭貼與名字"));
    this.setState({
      avatarUrl: this.props.avatar_url || "",
      username: this.props.username,
    });
  }
  public async componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any
  ): Promise<void> {
    if (prevProps.username !== this.props.username) {
      this.setState({ username: this.props.username });
    }
    if (prevProps.avatar_url !== this.props.avatar_url) {
      this.setState({
        avatarUrl: this.props.avatar_url || "",
        showDefaultAvatar: false,
      });
    }
  }
  public render(): React.ReactNode {
    return (
      <Form
        title="頭貼與名字"
        goBackHandler={() => {
          this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
            replace: true,
          });
        }}
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
              this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
                replace: true,
              })
            }
          >
            捨棄
          </Button>
        }
      >
        {this.state.showDefaultAvatar ? (
          <img className={styles.avatar_preview} src={imgPersonFill} alt="" />
        ) : (
          <img
            className={styles.avatar_preview}
            src={this.state.avatarUrl}
            alt=""
            onError={() => this.setState({ showDefaultAvatar: true })}
          />
        )}
        <LabeledInput
          title="頭貼 URL"
          type="text"
          value={this.state.avatarUrl || ""}
          onChange={(avatarUrl: string) =>
            this.setState({ avatarUrl: avatarUrl, showDefaultAvatar: false })
          }
          autoFocus
        />
        <LabeledInput
          title="名字"
          type="text"
          value={this.state.username}
          onChange={(username: string) => this.setState({ username: username })}
        />
      </Form>
    );
  }
  private handleClickSave = async (): Promise<void> => {
    await this.props
      .dispatch(
        updateAccountInfo({
          avatar_url: this.state.avatarUrl,
          username: this.state.username,
        })
      )
      .unwrap();
    this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
      replace: true,
    });
  };
}

export default connect(mapStateToProps)(withRouter(UserInfo));
