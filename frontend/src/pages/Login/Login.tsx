import React from "react";
import { connect } from "react-redux";

import google from "../../assets/google.png";
import { Button, FullLogo, PageMeta, ToastList } from "../../components";
import { loginWithGoogle } from "../../redux/slices/AccountSlice";
import { pushToast } from "../../redux/slices/ToastSlice";
import { AppDispatch, RootState } from "../../redux/store";
import Api from "../../utils/api";
import Env from "../../utils/env";
import Nav from "../../utils/nav";
import { clearReturnUrl, consumeReturnUrl } from "../../utils/returnUrl";
import { IRouter, withRouter } from "../../utils/router";
import styles from "./Login.module.scss";

const LOGIN_FAILED_MESSAGE = "登入失敗，請重新登入。";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.account;
  return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {
  coverImage: string | undefined;
  isRequestingAuthorizationUrl: boolean;
}

class Login extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = { coverImage: undefined, isRequestingAuthorizationUrl: false };
  }
  public componentWillUnmount(): void {
    window.removeEventListener("pageshow", this.handlePageShow);
  }
  public async componentDidMount(): Promise<void> {
    window.addEventListener("pageshow", this.handlePageShow);
    // Vite resolves the template only when its placeholder is a plain variable.
    const coverNumber = Math.floor(Math.random() * 5) + 1;
    this.setState({
      coverImage: (await import(`../../assets/cover0${coverNumber}.webp`)).default,
    });

    if (await Api.sendRequest("account/me", "get")) {
      clearReturnUrl();
      // Go to root if already login
      this.props.router.navigate(Env.frontendRootPath, { replace: true });
    } else if (this.props.router.search_params.get("code")) {
      try {
        const requestBody = new URLSearchParams();
        requestBody.append(
          "code",
          this.props.router.search_params.get("code") as string,
        );
        requestBody.append("state", this.props.router.search_params.get("state") ?? "");
        requestBody.append("redirect_uri", `${window.location.origin}/login`);
        await this.props.dispatch(loginWithGoogle(requestBody)).unwrap();

        Nav.clearSearchParams();

        this.props.router.navigate(consumeReturnUrl(), { replace: true });
      } catch {
        Nav.clearSearchParams();
      }
    } else if (this.props.router.search_params.get("error")) {
      const isCanceled =
        this.props.router.search_params.get("error") === "access_denied";
      Nav.clearSearchParams();
      if (!isCanceled) {
        this.props.dispatch(pushToast({ type: "error", text: LOGIN_FAILED_MESSAGE }));
      }
    }
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <PageMeta title="登入 | Taigu" noindex />
        <ToastList />
        <div className={styles.left}>
          <img src={this.state.coverImage} alt="cover" />
        </div>
        <div className={styles.right}>
          <div className={styles.greeting}>歡迎使用</div>
          <FullLogo size="l" />
          <Button
            className="white border l"
            waiting={this.props.isWaiting || this.state.isRequestingAuthorizationUrl}
            onClick={this.handleClickGoogleLogin}
          >
            <img className={styles.google_icon} src={google} alt="google login" />
            使用 Google 帳戶繼續
          </Button>
        </div>
      </div>
    );
  }
  private handleClickGoogleLogin = async () => {
    this.setState({ isRequestingAuthorizationUrl: true });
    let response;
    try {
      response = await Api.sendRequest(
        `account/authorization-url?redirect_uri=${window.location.origin}/login`,
        "get",
      );
    } catch (error) {
      this.setState({ isRequestingAuthorizationUrl: false });
      throw error;
    }
    window.location = response.authorization_url;
  };
  private handlePageShow = (event: PageTransitionEvent): void => {
    // Going back from Google may restore this page as it was left, with the button
    // still waiting.
    if (event.persisted) this.setState({ isRequestingAuthorizationUrl: false });
  };
}

export default connect(mapStateToProps)(withRouter(Login));
