import React from "react";
import { connect } from "react-redux";

import { Button, Form, LabeledInput } from "../../../components";
import { updateAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";

function mapStateToProps(rootState: RootState) {
  const { username, isWaiting } = rootState.account;
  return { username, isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  username: string;
}

class Username extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { username: "" };
  }
  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("名稱"));
    this.setState({ username: this.props.username });
  }
  public async componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any
  ): Promise<void> {
    if (prevProps.username !== this.props.username) {
      this.setState({ username: this.props.username });
    }
  }
  public render(): React.ReactNode {
    return (
      <Form
        title="名稱"
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
          title="名稱"
          type="text"
          value={this.state.username}
          onChange={(username: string) => this.setState({ username: username })}
          autoFocus
        />
      </Form>
    );
  }
  private handleClickSave = async (): Promise<void> => {
    await this.props
      .dispatch(updateAccountInfo({ username: this.state.username }))
      .unwrap();
    this.props.router.navigate(`${Env.frontendRootPath}${settingsPagePath}`, {
      replace: true,
    });
  };
}

export default connect(mapStateToProps)(withRouter(Username));
