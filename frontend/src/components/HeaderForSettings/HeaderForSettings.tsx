import styles from "./HeaderForSettings.module.scss";

import React from "react";
import { connect } from "react-redux";

import { RoundButton } from "..";
import { IconChevronLeft } from "../../icons";
import type { RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";

function mapStateToProps(rootState: RootState) {
  const { headerTitle } = rootState.settingsPage;
  return { headerTitle };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {}

interface State {}

class HeaderForSettings extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      <header className={styles.main}>
        <div className={styles.main_inner}>
          <div className={styles.left}>
            <RoundButton
              className="p-12"
              hint_text="上一頁"
              onClick={this.goToParentDirectory}
            >
              <IconChevronLeft sideLength="16" />
            </RoundButton>
            {this.props.headerTitle}
          </div>
        </div>
      </header>
    );
  }
  private goToParentDirectory = (): void => {
    let currentPath = this.props.router.location.pathname;
    if (currentPath[currentPath.length - 1] === "/") {
      currentPath = currentPath.slice(0, -1);
    }
    const parentDirectory = currentPath.substring(0, currentPath.lastIndexOf("/"));
    this.props.router.navigate(parentDirectory || Env.frontendRootPath, {
      replace: true,
    });
  };
}

export default connect(mapStateToProps)(withRouter(HeaderForSettings));
