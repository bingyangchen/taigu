import styles from "./Avatar.module.scss";

import React from "react";
import { connect } from "react-redux";

import { Button, Form, LabeledInput } from "../../../components";
import { updateAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";

function mapStateToProps(rootState: RootState) {
  const { avatar_url, isWaiting } = rootState.account;
  return { avatar_url, isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  avatarUrl: string;
}

class Avatar extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { avatarUrl: "" };
  }
  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("頭像"));
    this.setState({ avatarUrl: this.props.avatar_url || "" });
  }
  public async componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any
  ): Promise<void> {
    if (prevProps.avatar_url !== this.props.avatar_url) {
      this.setState({ avatarUrl: this.props.avatar_url || "" });
    }
  }
  public render(): React.ReactNode {
    return (
      <Form
        title="頭像"
        goBackHandler={() => {
          this.props.router.navigate(
            `${Env.frontendRootPath}${settingsPagePath}`,
            { replace: true }
          );
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
              this.props.router.navigate(
                `${Env.frontendRootPath}${settingsPagePath}`,
                { replace: true }
              )
            }
          >
            捨棄
          </Button>
        }
      >
        <LabeledInput
          title="頭像網址"
          type="text"
          value={this.state.avatarUrl || ""}
          onChange={(avatarUrl: string) =>
            this.setState({ avatarUrl: avatarUrl })
          }
          autoFocus
        />
        {this.state.avatarUrl && (
          <img
            className={styles.avatar_preview}
            src={this.state.avatarUrl}
            alt="圖片網址有誤"
          />
        )}
      </Form>
    );
  }
  private handleClickSave = async (): Promise<void> => {
    await this.props
      .dispatch(updateAccountInfo({ avatar_url: this.state.avatarUrl }))
      .unwrap();
    this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
      replace: true,
    });
  };
}

export default connect(mapStateToProps)(withRouter(Avatar));
