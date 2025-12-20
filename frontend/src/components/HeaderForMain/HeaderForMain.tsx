import React from "react";
import { connect } from "react-redux";

import { FullLogo } from "../../components";
import type { RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import Nav from "../../utils/nav";
import styles from "./HeaderForMain.module.scss";

function mapStateToProps(rootState: RootState) {
  const { scrollTop } = rootState.mainPage;
  return { mainScrollTop: scrollTop };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {}

interface State {}

class HeaderForMain extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render(): React.ReactNode {
    return (
      <header className={styles.main}>
        <FullLogo size="s" translateX={this.logoTranslateX} />
      </header>
    );
  }

  private get logoTranslateX(): number {
    if (Nav.isAtDetailsPage || Nav.isAtHandlingFeePage) {
      return 40;
    }
    return 0;
  }
}

export default connect(mapStateToProps)(withRouter(HeaderForMain));
