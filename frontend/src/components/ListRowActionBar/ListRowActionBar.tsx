import React, { MouseEvent, MouseEventHandler } from "react";

import { RoundButton } from "../../components";
import { IconPencilSquare, IconTrash } from "../../icons";
import styles from "./ListRowActionBar.module.scss";

interface Props {
  forMobile?: boolean;
  onClickEdit?: MouseEventHandler;
  onClickDelete?: MouseEventHandler;
}

interface State {}

export default class ListRowActionBar extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return this.props.forMobile ? (
      <>
        <div className={styles.tab_for_mobile} onClick={this.handleClickEdit}>
          <IconPencilSquare sideLength="18" />
          編輯
        </div>
        <div
          className={styles.tab_for_mobile + " " + styles.dangerous}
          onClick={this.handleClickDelete}
        >
          <IconTrash sideLength="18" />
          刪除
        </div>
      </>
    ) : (
      <span className={styles.main}>
        <RoundButton className="p-12" hint_text="編輯" onClick={this.handleClickEdit}>
          <IconPencilSquare sideLength="16" />
        </RoundButton>
        <RoundButton className="p-12" hint_text="刪除" onClick={this.handleClickDelete}>
          <IconTrash sideLength="16" />
        </RoundButton>
      </span>
    );
  }
  private handleClickEdit = (e: MouseEvent): void => {
    e.stopPropagation();
    this.props.onClickEdit?.(e);
  };
  private handleClickDelete = (e: MouseEvent): void => {
    e.stopPropagation();
    this.props.onClickDelete?.(e);
  };
}
