import React, { MouseEvent, MouseEventHandler } from "react";
import ReactDOM from "react-dom";

import { IRouter, withRouter } from "../../router";
import Util from "../../utils/util";
import styles from "./BottomSheet.module.scss";

interface Props extends IRouter {
  children?: React.ReactNode;
  onClickBackground: MouseEventHandler;
  canMaximize?: boolean;
}

interface State {
  touchStartY: number | null;
  touchEndY: number | null;
  touchDiffY: number | null;
  isMaximized: boolean;
  initialMainHeight: number;
}

class BottomSheet extends React.Component<Props, State> {
  public state: State;
  private modalRoot: HTMLElement;
  private maximizeThreshold: number = 100;
  private minimizeThreshold: number = 100;
  private transitionDuration: number = 150;
  private mainRef: React.RefObject<HTMLDivElement>;
  private headerRef: React.RefObject<HTMLDivElement>;
  public constructor(props: Props) {
    super(props);
    this.state = {
      touchStartY: null,
      touchEndY: null,
      touchDiffY: null,
      isMaximized: false,
      initialMainHeight: 0,
    };
    this.modalRoot = document.getElementById("modal-root")!;
    this.mainRef = React.createRef();
    this.headerRef = React.createRef();
  }
  public componentDidMount(): void {
    setTimeout(() => {
      this.props.router.navigate("#!");
      Util.changePWAThemeColor("#888");
      document.body.style.overscrollBehaviorY = "contain";
    });

    // Do not write this using React inline event handling
    this.headerRef.current!.addEventListener("touchstart", this.handleTouchStart);
    this.headerRef.current!.addEventListener("touchmove", this.handleTouchMove);
    this.headerRef.current!.addEventListener("touchend", this.handleTouchEnd);

    this.setState({ initialMainHeight: this.mainRef.current!.clientHeight });
  }
  public componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>,
    snapshot?: any,
  ): void {
    if (
      prevProps.router.location.hash === "#!" &&
      this.props.router.location.hash === ""
    ) {
      this.handleClickBackground({} as MouseEvent);
    }
  }
  public componentWillUnmount(): void {
    Util.changePWAThemeColor("#fff");
    document.body.style.overscrollBehaviorY = "initial";
    this.headerRef.current!.removeEventListener("touchstart", this.handleTouchStart);
    this.headerRef.current!.removeEventListener("touchmove", this.handleTouchMove);
    this.headerRef.current!.removeEventListener("touchend", this.handleTouchEnd);
  }
  public render(): React.ReactNode {
    return ReactDOM.createPortal(
      <>
        <div className={styles.background} onClick={this.handleClickBackground} />
        <div
          ref={this.mainRef}
          className={styles.main}
          style={{
            top:
              this.isTouchingAndMoving || this.isTransitioning
                ? `${this.state.touchEndY}px`
                : undefined,
            transitionDuration: this.isTouchingAndMoving
              ? "0ms"
              : `${this.transitionDuration}ms`,
            maxHeight:
              this.state.isMaximized || this.isTouchingAndMoving || this.isTransitioning
                ? "unset"
                : `${window.visualViewport!.height * 0.618}px`,
          }}
        >
          <div ref={this.headerRef} className={styles.header} />
          <div className={styles.body}>{this.props.children}</div>
        </div>
      </>,
      this.modalRoot,
    );
  }
  private get isTouchingAndMoving(): boolean {
    return this.state.touchDiffY !== null && this.state.touchEndY !== null;
  }
  private get isTransitioning(): boolean {
    return this.state.touchDiffY === null && this.state.touchEndY !== null;
  }
  private handleClickBackground = (e: MouseEvent): void => {
    if (this.props.router.location.hash === "#!") {
      this.props.router.navigate(-1);
    }
    setTimeout(() => this.props.onClickBackground(e));
  };
  private handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    this.setState({ touchStartY: touch.clientY });
  };
  private handleTouchMove = (e: TouchEvent): void => {
    const touch = e.changedTouches[0];
    this.setState((state, props) => {
      return {
        touchDiffY: touch.clientY - (state.touchStartY || 0),
        touchEndY: touch.clientY,
      };
    });
  };
  private handleTouchEnd = (e: TouchEvent) => {
    if (!this.state.isMaximized) {
      if (this.props.canMaximize && -this.state.touchDiffY! > this.maximizeThreshold) {
        this.setState({ touchEndY: 20, isMaximized: true });
      } else if (this.state.touchDiffY! > this.state.initialMainHeight * 0.382) {
        this.setState({ touchEndY: window.visualViewport!.height }, () => {
          setTimeout(
            () => this.handleClickBackground({} as MouseEvent),
            this.transitionDuration,
          );
        });
      } else {
        this.setState(
          { touchEndY: window.visualViewport!.height - this.state.initialMainHeight },
          () => {
            setTimeout(
              () => this.setState({ touchEndY: null }),
              this.transitionDuration,
            );
          },
        );
      }
    } else {
      if (this.state.touchDiffY! > this.minimizeThreshold) {
        this.setState(
          { touchEndY: window.visualViewport!.height - this.state.initialMainHeight },
          () => {
            setTimeout(() => {
              this.setState({ touchEndY: null, isMaximized: false });
            }, this.transitionDuration);
          },
        );
      } else this.setState({ touchEndY: 20 });
    }
    this.setState({ touchDiffY: null });
  };
}

export default withRouter(BottomSheet);
