import { memo, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button, Form, LabeledInput } from "../../../components";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { deleteAccount } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import Env from "../../../utils/env";
import { settingsPagePath } from "../../../utils/router";
import styles from "./DeleteAccount.module.scss";

function DeleteAccount() {
  const isWaiting = useAppSelector((state) => state.account.isWaiting);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  useLayoutEffect(() => {
    dispatch(updateHeaderTitle("刪除帳號"));
  }, [dispatch]);

  const handleClickCheckDelete = async (): Promise<void> => {
    await dispatch(deleteAccount({ password })).unwrap();
    navigate(`${Env.frontendRootPath}login`, { replace: true });
  };

  return (
    <Form
      primaryFooterButton={
        <Button
          variant="dangerous_fill"
          size="action"
          disabled={isWaiting}
          waiting={isWaiting}
          onClick={handleClickCheckDelete}
        >
          確認刪除
        </Button>
      }
      secondaryFooterButton={
        <Button
          variant="light"
          size="action"
          onClick={() =>
            navigate(`${Env.frontendRootPath}${settingsPagePath}`, { replace: true })
          }
        >
          捨棄
        </Button>
      }
    >
      <div className={styles.description}>提醒您，帳號刪除後即無法復原。</div>
      <LabeledInput
        title="密碼"
        type="password"
        autocomplete="new-password"
        value={password}
        onChange={setPassword}
      />
    </Form>
  );
}

export default memo(DeleteAccount);
