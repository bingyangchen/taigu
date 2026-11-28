import MD5 from "crypto-js/md5";
import { memo, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import imgPersonFill from "../../../assets/person-fill.svg";
import {
  BeautifulBlock,
  BottomSheet,
  Button,
  Form,
  LabeledInputV2,
  Modal,
} from "../../../components";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateAccountInfo } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import { pushToast } from "../../../redux/slices/ToastSlice";
import { useIsNarrowLayout } from "../../../utils/mediaQuery";
import { returnToSettings } from "../../../utils/router";
import Util from "../../../utils/util";
import styles from "./UserInfo.module.scss";

function UserInfo() {
  const savedAvatarUrl = useAppSelector((state) => state.account.avatar_url);
  const savedUsername = useAppSelector((state) => state.account.username);
  const email = useAppSelector((state) => state.account.email);
  const isWaiting = useAppSelector((state) => state.account.isWaiting);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const isNarrowLayout = useIsNarrowLayout();
  const [showDefaultAvatar, setShowDefaultAvatar] = useState(false);
  const [validGravatarUrl, setValidGravatarUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(savedAvatarUrl ?? "");
  const [username, setUsername] = useState(savedUsername);
  const [activeModalName, setActiveModalName] = useState<"gravatar" | null>(null);
  const [shouldBlinkAvatarInput, setShouldBlinkAvatarInput] = useState(false);

  useLayoutEffect(() => {
    dispatch(updateHeaderTitle("頭像與名字"));
  }, [dispatch]);

  // The fields start from the saved account, and follow it when the account data
  // loads or changes while the page is open.
  useLayoutEffect(() => {
    setUsername(savedUsername);
  }, [savedUsername]);
  useLayoutEffect(() => {
    setAvatarUrl(savedAvatarUrl ?? "");
    setShowDefaultAvatar(false);
  }, [savedAvatarUrl]);

  useEffect(() => {
    if (!email) return;
    const checkIfGravatarExists = async (): Promise<void> => {
      const emailHash = MD5(email.toLowerCase().trim()).toString();
      const url = `https://www.gravatar.com/avatar/${emailHash}?d=404&s=128`;
      const response = await fetch(url);
      setValidGravatarUrl(response.ok ? url : null);
    };
    void checkIfGravatarExists();
  }, [email]);

  const handleClickGravatarApply = (): void => {
    if (validGravatarUrl) {
      setAvatarUrl(validGravatarUrl);
      setActiveModalName(null);
      setShowDefaultAvatar(false);
      setShouldBlinkAvatarInput(true);
      setTimeout(() => setShouldBlinkAvatarInput(false), 500);
    }
  };

  const handleClickSave = async (): Promise<void> => {
    const trimmedUsername = username.trim();
    if (
      Array.from(trimmedUsername).length < 1 ||
      Array.from(trimmedUsername).length > 64
    ) {
      dispatch(pushToast({ type: "error", text: "名字需為 1 到 64 個字。" }));
      return;
    }
    const validatedAvatarUrl = Util.validateAndSanitizeUrl(avatarUrl);

    if (avatarUrl && !validatedAvatarUrl) {
      dispatch(
        pushToast({ type: "error", text: "無效的頭像 URL，請檢查格式是否正確" }),
      );
      return;
    }

    await dispatch(
      updateAccountInfo({
        avatar_url: validatedAvatarUrl ?? "",
        username: trimmedUsername,
      }),
    ).unwrap();
    returnToSettings({ location, navigate });
  };

  return (
    <>
      {activeModalName === "gravatar" &&
        (isNarrowLayout ? (
          <BottomSheet onClickBackground={() => setActiveModalName(null)}>
            <div className={styles.gravatar_modal_content}>
              <img
                className={styles.gravatar_preview}
                src={validGravatarUrl ?? imgPersonFill}
                alt=""
              />
              <div className={styles.gravatar_bottom_sheet_buttons}>
                <Button
                  variant="primary_fill"
                  size="action"
                  round
                  onClick={handleClickGravatarApply}
                >
                  套用
                </Button>
                <Button
                  variant="transparent"
                  size="action"
                  round
                  onClick={() => setActiveModalName(null)}
                >
                  捨棄
                </Button>
              </div>
            </div>
          </BottomSheet>
        ) : (
          <Modal
            title="使用 Gravatar 頭像"
            discardButtonProps={{
              children: "捨棄",
              variant: "light",
              onClick: () => setActiveModalName(null),
            }}
            submitButtonProps={{
              children: "套用",
              variant: "primary_fill",
              onClick: handleClickGravatarApply,
            }}
          >
            <div className={styles.gravatar_modal_content}>
              <img
                className={styles.gravatar_preview}
                src={validGravatarUrl ?? imgPersonFill}
                alt=""
              />
            </div>
          </Modal>
        ))}
      <div className={styles.main}>
        <Form
          primaryFooterButton={
            <Button
              variant="primary_fill"
              size="action"
              disabled={isWaiting}
              waiting={isWaiting}
              onClick={handleClickSave}
            >
              儲存
            </Button>
          }
          secondaryFooterButton={
            <Button
              variant="light"
              size="action"
              onClick={() => returnToSettings({ location, navigate })}
            >
              捨棄
            </Button>
          }
        >
          <img
            className={styles.avatar_preview}
            src={
              showDefaultAvatar
                ? imgPersonFill
                : (Util.validateAndSanitizeUrl(avatarUrl) ?? imgPersonFill)
            }
            alt=""
            onError={() => setShowDefaultAvatar(true)}
          />
          {validGravatarUrl && (
            <button
              className={styles.gravatar_button}
              onClick={() => setActiveModalName("gravatar")}
            >
              使用 Gravatar 頭像
            </button>
          )}
          <BeautifulBlock>
            <div className={styles.avatarInputWrapper}>
              {shouldBlinkAvatarInput && <div className={styles.blinkOverlay} />}
              <LabeledInputV2
                title="頭像位置"
                type="text"
                value={avatarUrl || ""}
                onChange={(value: string) => {
                  setAvatarUrl(value);
                  setShowDefaultAvatar(false);
                }}
                autoFocus
              />
            </div>
            <LabeledInputV2
              title="名字"
              type="text"
              value={username}
              onChange={setUsername}
            />
          </BeautifulBlock>
        </Form>
      </div>
    </>
  );
}

export default memo(UserInfo);
