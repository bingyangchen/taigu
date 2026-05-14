import React from "react";
import { connect } from "react-redux";

import type { RootState } from "../../redux/store";
import Util from "../../utils/util";

function mapStateToProps(rootState: RootState) {
  return { scrollTop: rootState.mainPage.scrollTop };
}

interface OwnProps {
  children: React.ReactNode;
  activeClassName: string;
  className: string;
  hiddenClassName: string;
  noTransitionClassName: string;
}

interface State {
  isActivated: boolean;
  isVisible: boolean;
  shouldAnimate: boolean;
}

type Props = OwnProps & ReturnType<typeof mapStateToProps>;

class ScrollAwareFloatingControls extends React.Component<Props, State> {
  public state: State = { isActivated: false, isVisible: true, shouldAnimate: true };
  private controlsRef = React.createRef<HTMLDivElement>();
  private activationScrollTop = 0;
  private lastScrollTop = 0;
  private upwardDistance = 0;
  private downwardDistance = 0;

  public componentDidMount(): void {
    this.lastScrollTop = this.props.scrollTop;
    this.activationScrollTop = this.getActivationScrollTop();
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (!Util.isMobile || prevProps.scrollTop === this.props.scrollTop) return;

    const delta = this.props.scrollTop - this.lastScrollTop;
    this.lastScrollTop = this.props.scrollTop;

    if (!this.state.isActivated) {
      if (this.props.scrollTop >= this.activationScrollTop && delta > 0) {
        this.upwardDistance = 0;
        this.downwardDistance = 0;
        this.setState({ isActivated: true, isVisible: false, shouldAnimate: false });
      }
      return;
    }

    if (this.props.scrollTop < this.activationScrollTop) {
      this.upwardDistance = 0;
      this.downwardDistance = 0;
      this.setState({ isActivated: false, isVisible: true, shouldAnimate: true });
      return;
    }

    if (delta > 0) {
      this.downwardDistance += delta;
      this.upwardDistance = 0;
      if (this.downwardDistance >= 8 && this.state.isVisible) {
        this.setState({ isVisible: false, shouldAnimate: true });
      }
    } else if (delta < 0) {
      this.upwardDistance += Math.abs(delta);
      this.downwardDistance = 0;
      if (this.upwardDistance >= 12 && !this.state.isVisible) {
        this.setState({ isVisible: true, shouldAnimate: true });
      }
    }
  }

  public render(): React.ReactNode {
    const isActivated = Util.isMobile && this.state.isActivated;
    return (
      <div
        ref={this.controlsRef}
        className={`${this.props.className} ${
          isActivated ? this.props.activeClassName : ""
        } ${isActivated && !this.state.isVisible ? this.props.hiddenClassName : ""} ${
          isActivated && !this.state.shouldAnimate
            ? this.props.noTransitionClassName
            : ""
        }`}
      >
        {this.props.children}
      </div>
    );
  }

  private getActivationScrollTop(): number {
    const controlsElement = this.controlsRef.current;
    if (!controlsElement) return 0;
    return this.props.scrollTop + controlsElement.getBoundingClientRect().bottom;
  }
}

export default connect(mapStateToProps)(ScrollAwareFloatingControls);
