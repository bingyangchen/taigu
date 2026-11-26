import { memo, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import google from "../../assets/google.png";
import { Button, FullLogo, PageMeta, ToastList } from "../../components";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { loginWithGoogle } from "../../redux/slices/AccountSlice";
import { pushToast } from "../../redux/slices/ToastSlice";
import Api from "../../utils/api";
import Env from "../../utils/env";
import Nav from "../../utils/nav";
import { clearReturnUrl, consumeReturnUrl } from "../../utils/returnUrl";
import {
  makeGoogleCodeRequestBody,
  useGoogleAuthorization,
} from "../../utils/useGoogleAuthorization";
import { useLatestRef } from "../../utils/useLatestRef";
import styles from "./Login.module.scss";

const LOGIN_FAILED_MESSAGE = "登入失敗，請重新登入。";
const LOGIN_PATH = "/login";

function Login() {
  const isWaiting = useAppSelector((state) => state.account.isWaiting);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const { isRequestingAuthorizationUrl, startGoogleAuthorization } =
    useGoogleAuthorization(LOGIN_PATH);

  // The sign-in below reads the query string after a request resolves, by which time
  // the URL may have changed.
  const searchParamsRef = useLatestRef(searchParams);

  useEffect(() => {
    const signIn = async (): Promise<void> => {
      // Vite resolves the template only when its placeholder is a plain variable.
      const coverNumber = Math.floor(Math.random() * 5) + 1;
      setCoverImage((await import(`../../assets/cover0${coverNumber}.webp`)).default);

      if (await Api.sendRequest("account/me", "get")) {
        clearReturnUrl();
        // Go to root if already login
        navigate(Env.frontendRootPath, { replace: true });
      } else if (searchParamsRef.current.get("code")) {
        try {
          const requestBody = makeGoogleCodeRequestBody(
            searchParamsRef.current,
            LOGIN_PATH,
          );
          await dispatch(loginWithGoogle(requestBody)).unwrap();

          Nav.clearSearchParams();

          navigate(consumeReturnUrl(), { replace: true });
        } catch {
          Nav.clearSearchParams();
        }
      } else if (searchParamsRef.current.get("error")) {
        const isCanceled = searchParamsRef.current.get("error") === "access_denied";
        Nav.clearSearchParams();
        if (!isCanceled) {
          dispatch(pushToast({ type: "error", text: LOGIN_FAILED_MESSAGE }));
        }
      }
    };
    void signIn();
  }, [dispatch, navigate, searchParamsRef]);

  return (
    <div className={styles.main}>
      <PageMeta title="登入 | Taigu" noindex />
      <ToastList />
      <div className={styles.left}>
        <img src={coverImage} alt="cover" />
      </div>
      <div className={styles.right}>
        <div className={styles.greeting}>歡迎使用</div>
        <FullLogo size="l" />
        <Button
          variant="white"
          size="l"
          bordered
          waiting={isWaiting || isRequestingAuthorizationUrl}
          onClick={startGoogleAuthorization}
        >
          <img className={styles.google_icon} src={google} alt="google login" />
          使用 Google 帳戶繼續
        </Button>
      </div>
    </div>
  );
}

export default memo(Login);
