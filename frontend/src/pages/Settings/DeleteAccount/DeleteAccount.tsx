import styles from "./DeleteAccount.module.scss";

import React from "react";
import { connect } from "react-redux";

import { Button, Form, LabeledInput } from "../../../components";
import { deleteAccount } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch, RootState } from "../../../redux/store";
import { IRouter, settingsPagePath, withRouter } from "../../../router";
import Env from "../../../utils/env";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.account;
  return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  password: string;
}

class DeleteAccount extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { password: "" };
  }
  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("刪除帳號"));
  }
  public render(): React.ReactNode {
    return (
      <Form
        title="刪除帳號"
        goBackHandler={() => {
          this.props.router.navigate(
            `${Env.frontendRootPath}${settingsPagePath}`,
            { replace: true }
          );
        }}
        primaryFooterButton={
          <Button
            className="dangerous_fill l"
            disabled={this.props.isWaiting}
            waiting={this.props.isWaiting}
            onClick={this.handleClickCheckDelete}
          >
            確認刪除
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
        <div className={styles.description}>提醒您，帳號刪除後即無法復原。</div>
        <LabeledInput
          title="密碼"
          type="password"
          autocomplete="new-password"
          value={this.state.password}
          onChange={(password: string) => this.setState({ password: password })}
        />
      </Form>
    );
  }
  private handleClickCheckDelete = async (): Promise<void> => {
    await this.props
      .dispatch(deleteAccount({ password: this.state.password }))
      .unwrap();
    this.props.router.navigate(`${Env.frontendRootPath}login`, {
      replace: true,
    });
  };
}

export default connect(mapStateToProps)(withRouter(DeleteAccount));
