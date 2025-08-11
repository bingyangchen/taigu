import React from "react";
import { connect } from "react-redux";

import { FullLogo, NavTab, RoundButton } from "..";
import { IconChevronLeft } from "../../icons";
import { AppDispatch, RootState } from "../../redux/store";
import { IRouter, withRouter } from "../../router";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import styles from "./NavBarForSettings.module.scss";

function mapStateToProps(rootState: RootState) {
  const { isWaiting } = rootState.account;
  return { isWaiting };
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  subpages: Subpage[];
  dispatch: AppDispatch;
}

interface State {}

class NavBarForSettings extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.header}>
          <RoundButton
            className="p-12"
            hint_text="回首頁"
            onClick={() =>
              this.props.router.navigate(`${Env.frontendRootPath}`, { replace: true })
            }
          >
            <IconChevronLeft sideLength="16" />
          </RoundButton>
          帳號與設定
        </div>
        <div className={styles.subpage_list}>
          {this.props.subpages.map((subpage, idx) => {
            return (
              <NavTab
                page={subpage}
                onClick={() => {
                  this.scrollDivIntoView(subpage.path);
                }}
                key={idx}
                replace
                isCustomActive={this.props.router.location.hash === subpage.path}
              />
            );
          })}
        </div>
        <div className={styles.footer}>
          <div className={styles.logo_outer}>
            <FullLogo size="s" />
          </div>
          <div className={styles.copyright}>
            © Taigu 2021-{new Date().getFullYear()}
          </div>
        </div>
      </div>
    );
  }
  private scrollDivIntoView = (hash: string): void => {
    document
      .getElementById(hash.replaceAll("#", ""))
      ?.scrollIntoView({ behavior: "smooth" });
  };
}

export default connect(mapStateToProps)(withRouter(NavBarForSettings));
