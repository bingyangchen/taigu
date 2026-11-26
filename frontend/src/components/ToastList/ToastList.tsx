import { memo, useState } from "react";
import ReactDOM from "react-dom";

import { RoundButton } from "../../components";
import * as Icons from "../../icons";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { removeToast } from "../../redux/slices/ToastSlice";
import styles from "./ToastList.module.scss";

function ToastList() {
  const toasts = useAppSelector((state) => state.toast.toasts);
  const dispatch = useAppDispatch();
  const [toastRoot] = useState(() => {
    const element = document.getElementById("toast-root");
    if (!element) {
      throw new Error("Missing #toast-root element");
    }
    return element;
  });

  return ReactDOM.createPortal(
    <div className={styles.main}>
      {toasts.map((each, idx) => {
        return (
          <div key={each.id} className={styles.toast_outer}>
            <div className={`${styles.toast} ${styles[each.type]}`}>
              {each.text}
              <RoundButton
                onClick={() => dispatch(removeToast(idx))}
                className={styles.close_button}
              >
                <Icons.IconXLarge sideLength="8" />
              </RoundButton>
            </div>
          </div>
        );
      })}
    </div>,
    toastRoot,
  );
}

export default memo(ToastList);
