import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import React, { MouseEvent, MouseEventHandler } from "react";

import { IRouter, withRouter } from "../../router";
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
  private maximizeThreshold: number = 100;
  private minimizeThreshold: number = 100;
  private transitionDuration: number = 150;
  private mainRef: React.RefObject<HTMLDivElement>;
  private isClosing: boolean = false;
  public constructor(props: Props) {
    super(props);
    this.state = {
      touchStartY: null,
      touchEndY: null,
      touchDiffY: null,
      isMaximized: false,
      initialMainHeight: 0,
    };
    this.mainRef = React.createRef();
  }
  public componentDidMount(): void {
    setTimeout(() => {
      this.props.router.navigate("#!");
      document.body.style.overscrollBehaviorY = "contain";
    });

    this.setState({ initialMainHeight: this.mainRef.current?.clientHeight ?? 0 });
  }
  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.router.location.hash === "#!" &&
      this.props.router.location.hash === ""
    ) {
      this.handleClickBackground({} as MouseEvent);
    }
  }
  public componentWillUnmount(): void {
    document.body.style.overscrollBehaviorY = "initial";
  }
  public render(): React.ReactNode {
    return (
      <Dialog.Root open onOpenChange={this.handleOpenChange}>
        <Dialog.Portal container={document.getElementById("modal-root") ?? undefined}>
          <Dialog.Overlay className={styles.background} />
          <Dialog.Content
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
                this.state.isMaximized ||
                this.isTouchingAndMoving ||
                this.isTransitioning
                  ? "unset"
                  : `${this.viewportHeight * 0.618}px`,
            }}
          >
            <VisuallyHidden.Root asChild>
              <Dialog.Title>操作選單</Dialog.Title>
            </VisuallyHidden.Root>
            <div
              className={styles.header}
              onTouchStart={this.handleTouchStart}
              onTouchMove={this.handleTouchMove}
              onTouchEnd={this.handleTouchEnd}
            />
            <div className={styles.body}>{this.props.children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
  private get isTouchingAndMoving(): boolean {
    return this.state.touchDiffY !== null && this.state.touchEndY !== null;
  }
  private get isTransitioning(): boolean {
    return this.state.touchDiffY === null && this.state.touchEndY !== null;
  }
  private get viewportHeight(): number {
    return window.visualViewport?.height ?? window.innerHeight;
  }
  private handleOpenChange = (open: boolean): void => {
    if (!open) {
      this.handleClickBackground({} as MouseEvent);
    }
  };
  private handleClickBackground = (e: MouseEvent): void => {
    if (this.isClosing) return;
    this.isClosing = true;
    if (this.props.router.location.hash === "#!") {
      this.props.router.navigate(-1);
    }
    setTimeout(() => this.props.onClickBackground(e));
  };
  private handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    const touch = e.touches[0];
    this.setState({ touchStartY: touch.clientY });
  };
  private handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    const touch = e.changedTouches[0];
    this.setState((state) => {
      return {
        touchDiffY: touch.clientY - (state.touchStartY ?? 0),
        touchEndY: touch.clientY,
      };
    });
  };
  private handleTouchEnd = (): void => {
    const touchDiffY = this.state.touchDiffY ?? 0;
    if (!this.state.isMaximized) {
      if (this.props.canMaximize && -touchDiffY > this.maximizeThreshold) {
        this.setState({ touchEndY: 20, isMaximized: true });
      } else if (touchDiffY > this.state.initialMainHeight * 0.382) {
        this.setState({ touchEndY: this.viewportHeight }, () => {
          setTimeout(
            () => this.handleClickBackground({} as MouseEvent),
            this.transitionDuration,
          );
        });
      } else {
        this.setState(
          { touchEndY: this.viewportHeight - this.state.initialMainHeight },
          () => {
            setTimeout(
              () => this.setState({ touchEndY: null }),
              this.transitionDuration,
            );
          },
        );
      }
    } else {
      if (touchDiffY > this.minimizeThreshold) {
        this.setState(
          { touchEndY: this.viewportHeight - this.state.initialMainHeight },
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
