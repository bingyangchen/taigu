import google from "../../assets/google.png";
import styles from "./Login.module.scss";

import React from "react";
import { connect } from "react-redux";

import { Button, FullLogo, ToastList } from "../../components";
import { loginWithGoogle } from "../../redux/slices/AccountSlice";
import { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import Api from "../../utils/api";
import Env from "../../utils/env";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.account;
  return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  coverImage: string | undefined;
}

class Login extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { coverImage: undefined };
  }
  public async componentDidMount(): Promise<void> {
    // Randomly select and import a cover image
    this.setState({
      coverImage: (
        await import(`../../assets/cover00${Math.floor(Math.random() * 5) + 1}.png`)
      ).default,
    });

    if (await Api.sendRequest("account/me", "get")) {
      // Go to root if already login
      this.props.router.navigate(Env.frontendRootPath, { replace: true });
    } else if (this.props.router.search_params.get("code")) {
      try {
        const requestBody = new URLSearchParams();
        requestBody.append(
          "code",
          this.props.router.search_params.get("code") as string,
        );
        requestBody.append("redirect_uri", `${window.location.origin}/login`);
        await this.props.dispatch(loginWithGoogle(requestBody)).unwrap();

        const currentUrl = new URL(window.location.href);
        currentUrl.search = "";
        window.history.replaceState({}, "", currentUrl.href);

        const pathAndQueryString =
          window.localStorage.getItem("pathAndQueryString") || Env.frontendRootPath;
        window.localStorage.removeItem("pathAndQueryString");
        this.props.router.navigate(pathAndQueryString, { replace: true });
      } catch (error) {
        const currentUrl = new URL(window.location.href);
        currentUrl.search = "";
        window.history.replaceState({}, "", currentUrl.href);
      }
    }
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <ToastList />
        <div className={styles.left}>
          <img src={this.state.coverImage} alt="cover" />
        </div>
        <div className={styles.right}>
          <div className={styles.greeting}>歡迎使用</div>
          <FullLogo size="l" />
          <Button
            className="white border l"
            disabled={this.props.isWaiting}
            waiting={this.props.isWaiting}
            onClick={this.handleClickGoogleLogin}
          >
            <img className={styles.google_icon} src={google} alt="google login" />
            {!this.props.isWaiting && "使用 Google 帳戶繼續"}
          </Button>
        </div>
      </div>
    );
  }
  private handleClickGoogleLogin = async () => {
    const response = await Api.sendRequest(
      `account/authorization-url?redirect_uri=${window.location.origin}/login`,
      "get",
    );
    window.location = response.authorization_url;
  };
}

export default connect(mapStateToProps)(withRouter(Login));
