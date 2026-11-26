import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { memo, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import googleLogo from "../../../assets/google.png";
import {
  BeautifulBlock,
  BeautifulRow,
  BottomSheet,
  Button,
  FullLogo,
  LoadingIcon,
  Modal,
} from "../../../components";
import * as Icons from "../../../icons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { changeAccountBinding } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import { COLORS } from "../../../styles/tokens";
import Api from "../../../utils/api";
import Nav from "../../../utils/nav";
import { settingsPagePath } from "../../../utils/router";
import {
  makeGoogleCodeRequestBody,
  useGoogleAuthorization,
} from "../../../utils/useGoogleAuthorization";
import { useLatestRef } from "../../../utils/useLatestRef";
import Util from "../../../utils/util";
import styles from "./AccountBinding.module.scss";

const BINDING_FAILED_MESSAGE = "更換綁定的帳號失敗，請再試一次。";

const ACCOUNT_BINDING_PATH = `/${settingsPagePath}/account-binding`;

function AccountBinding() {
  const email = useAppSelector((state) => state.account.email);
  const isAccountWaiting = useAppSelector((state) => state.account.isWaiting);
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const [activeModalName, setActiveModalName] = useState<"changeBinding" | null>(null);
  const { isRequestingAuthorizationUrl, startGoogleAuthorization } =
    useGoogleAuthorization(ACCOUNT_BINDING_PATH);

  // The binding below reads the query string after a request resolves, by which
  // time the URL may have changed.
  const searchParamsRef = useLatestRef(searchParams);

  useLayoutEffect(() => {
    dispatch(updateHeaderTitle("帳號綁定"));
  }, [dispatch]);

  useLayoutEffect(() => {
    const bindAccount = async (): Promise<void> => {
      if (searchParamsRef.current.get("code")) {
        try {
          const requestBody = makeGoogleCodeRequestBody(
            searchParamsRef.current,
            ACCOUNT_BINDING_PATH,
          );
          await dispatch(changeAccountBinding(requestBody));
        } finally {
          Nav.clearSearchParams();
        }
      } else if (searchParamsRef.current.get("error")) {
        // When logged out, this request's 401 already sends the user to the welcome
        // page and saves this URL for after login, so return without clearing the
        // URL; the error is handled when the user comes back logged in (ACCT-R12).
        if (!(await Api.sendRequest("account/me", "get"))) return;
        const isCanceled = searchParamsRef.current.get("error") === "access_denied";
        Nav.clearSearchParams();
        if (!isCanceled) {
          dispatch(pushToast({ type: "error", text: BINDING_FAILED_MESSAGE }));
        }
      }
    };
    void bindAccount();
  }, [dispatch, searchParamsRef]);

  const handleClickGoogleLogin = (): void => {
    setActiveModalName(null);
    void startGoogleAuthorization();
  };

  // The binding flow starts from the 「更換綁定的帳號」 row, so the row shows the waiting state.
  const isWaiting = isAccountWaiting || isRequestingAuthorizationUrl;
  return (
    <>
      {activeModalName === "changeBinding" &&
        (Util.isMobile ? (
          <BottomSheet onClickBackground={() => setActiveModalName(null)}>
            <div className={styles.bottom_sheet_row} onClick={handleClickGoogleLogin}>
              <img className={styles.google_logo} src={googleLogo} alt="" />
              綁定 Google 帳號
            </div>
          </BottomSheet>
        ) : (
          <Modal
            title="更換綁定的帳號"
            noFooter
            discardButtonProps={{
              children: null,
              onClick: () => setActiveModalName(null),
            }}
          >
            <div className={styles.model_body}>
              <Button
                variant="white"
                size="l"
                bordered
                waiting={isAccountWaiting}
                onClick={handleClickGoogleLogin}
              >
                <img className={styles.google_logo} src={googleLogo} alt="" />
                綁定 Google 帳號
              </Button>
            </div>
          </Modal>
        ))}
      <div className={styles.main}>
        <div className={styles.logo_container}>
          <FullLogo size="l" />
          <Icons.IconLink sideLength="16px" color={COLORS.textSecondary} />
          <img className={styles.google_logo} src={googleLogo} alt="" />
        </div>
        <BeautifulBlock>
          <div className={styles.bound_account}>
            <span>綁定的帳號</span>
            <span className={styles.bound_account_email}>{email}</span>
          </div>
          <BeautifulRow
            onClick={isWaiting ? undefined : () => setActiveModalName("changeBinding")}
          >
            <div className={styles.beautiful_row_content}>
              {isWaiting ? (
                <>
                  <LoadingIcon />
                  <VisuallyHidden.Root>更換綁定的帳號</VisuallyHidden.Root>
                </>
              ) : (
                "更換綁定的帳號"
              )}
            </div>
          </BeautifulRow>
        </BeautifulBlock>
      </div>
    </>
  );
}

export default memo(AccountBinding);
