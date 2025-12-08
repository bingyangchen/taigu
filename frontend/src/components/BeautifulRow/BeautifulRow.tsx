import React, { MouseEvent, MouseEventHandler } from "react";

import { IconChevronRight } from "../../icons";
import styles from "./BeautifulRow.module.scss";

interface Props {
  label?: string;
  children?: any;
  onClick?: MouseEventHandler;
}

interface State {
  isRippling: boolean;
}

export default class BeautifulRow extends React.Component<Props, State> {
  public state: State;
  private rippleRef: React.RefObject<HTMLDivElement>;
  public constructor(props: Props) {
    super(props);
    this.state = { isRippling: false };
    this.rippleRef = React.createRef();
  }
  public render(): React.ReactNode {
    return (
      <div className={this.mainClassName}>
        <div className={styles.mask} onClick={this.handleClick}>
          {this.state.isRippling && (
            <div className={styles.ripple} ref={this.rippleRef} />
          )}
        </div>
        {this.props.label && <div className={styles.label}>{this.props.label}</div>}
        <div className={styles.value}>
          {typeof this.props.children === "string"
            ? this.string2jsx(this.props.children)
            : this.props.children}
        </div>
        {this.props.onClick && (
          <div className={styles.tail_mark}>
            <IconChevronRight sideLength="13" />
          </div>
        )}
      </div>
    );
  }
  private get mainClassName(): string {
    return `${styles.main} ${this.props.onClick ? styles.reactive : ""}`;
  }
  private handleClick = (e: MouseEvent): void => {
    if (this.props.onClick) {
      const mask = e.currentTarget as HTMLElement;
      const diameter = Math.max(mask.clientWidth, mask.clientHeight);
      this.setState({ isRippling: true }, () => {
        this.rippleRef.current!.style.width = `${diameter}px`;
        this.rippleRef.current!.style.height = `${diameter}px`;
        this.rippleRef.current!.style.left = `${
          e.clientX - mask.getBoundingClientRect().left - diameter / 2
        }px`;
        this.rippleRef.current!.style.top = `${
          e.clientY - mask.getBoundingClientRect().top - diameter / 2
        }px`;
      });
      setTimeout(() => {
        this.setState({ isRippling: false });
        this.props.onClick?.(e);
      }, 250);
    }
  };
  private string2jsx(s: string): React.ReactNode {
    const stringList: string[] = s.split("\n");
    return stringList.map((each, idx) => {
      return (
        <React.Fragment key={idx}>
          <div className={styles.s}>{each || " "}</div>
        </React.Fragment>
      );
    });
  }
}
