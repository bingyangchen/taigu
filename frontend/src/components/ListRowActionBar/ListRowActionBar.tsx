import { MouseEvent, MouseEventHandler } from "react";

import { RoundButton } from "../../components";
import * as Icons from "../../icons";
import styles from "./ListRowActionBar.module.scss";

interface Props {
  forMobile?: boolean;
  onClickEdit?: MouseEventHandler;
  onClickDelete?: MouseEventHandler;
}

export default function ListRowActionBar({
  forMobile,
  onClickEdit,
  onClickDelete,
}: Props) {
  const handleClickEdit = (e: MouseEvent): void => {
    e.stopPropagation();
    onClickEdit?.(e);
  };
  const handleClickDelete = (e: MouseEvent): void => {
    e.stopPropagation();
    onClickDelete?.(e);
  };

  return forMobile ? (
    <>
      <div className={styles.tab_for_mobile} onClick={handleClickEdit}>
        <Icons.IconPencilSquare sideLength="18" />
        編輯
      </div>
      <div
        className={styles.tab_for_mobile + " " + styles.dangerous}
        onClick={handleClickDelete}
      >
        <Icons.IconTrash sideLength="18" />
        刪除
      </div>
    </>
  ) : (
    <span className={styles.main}>
      <RoundButton size="l" hint_text="刪除" onClick={handleClickDelete}>
        <Icons.IconTrash sideLength="16" />
      </RoundButton>
    </span>
  );
}
