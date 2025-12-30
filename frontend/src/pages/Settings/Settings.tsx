import React from "react";
import { connect } from "react-redux";
import { Outlet } from "react-router-dom";

import { HeaderForSettings, ToastList } from "../../components";
import {
  fetchAccountInfo,
  refreshAccountInfoWithNonCacheResponse,
} from "../../redux/slices/AccountSlice";
import type { AppDispatch } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import Nav from "../../utils/nav";
import styles from "./Settings.module.scss";

interface Props extends IRouter {
  dispatch: AppDispatch;
}
interface State {
  prevLocationPathname: string | null;
}

class Settings extends React.Component<Props, State> {
  public state: State;
  private channel: BroadcastChannel;
  public constructor(props: Props) {
    super(props);
    this.state = { prevLocationPathname: null };
    this.channel = new BroadcastChannel(Env.broadcastChannelName);
    this.channel.addEventListener("message", this.handleNonCacheResponse);
  }

  public async componentDidMount(): Promise<void> {
    this.props.dispatch(fetchAccountInfo());
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    // Conditionally navigate back one more time
    if (prevProps.router.location.key !== this.props.router.location.key) {
      if (
        prevProps.router.location.pathname === this.props.router.location.pathname &&
        prevProps.router.location.hash === this.props.router.location.hash &&
        prevProps.router.location.search === this.props.router.location.search &&
        prevProps.router.location.state === this.props.router.location.state
      ) {
        this.setState(
          { prevLocationPathname: prevProps.router.location.pathname },
          () => this.props.router.navigate(-1),
        );
      } else this.setState({ prevLocationPathname: null });
    }
  }

  public componentWillUnmount(): void {
    this.channel.close();
  }

  public render(): React.ReactNode {
    return (
      <main className={styles.main}>
        <ToastList />
        <div className={styles.body}>
          <HeaderForSettings />
          <Outlet />
        </div>
      </main>
    );
  }

  private handleNonCacheResponse = async (
    e: MessageEvent<{ authorized: boolean; url: string; data: any }>,
  ): Promise<void> => {
    if (e.data.authorized) {
      if (/account\/me[/]?$/gs.test(e.data.url)) {
        this.props.dispatch(refreshAccountInfoWithNonCacheResponse(e.data.data));
      }
    } else {
      Nav.goToWelcomePage(
        this.props.router.location.pathname + this.props.router.location.search,
      );
    }
  };
}

export default connect()(withRouter(Settings));
