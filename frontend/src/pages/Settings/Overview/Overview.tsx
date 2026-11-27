import React, { memo, useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import googleLogo from "../../../assets/google.png";
import imgPersonFill from "../../../assets/person-fill.svg";
import {
  BeautifulBlock,
  BeautifulRow,
  FullLogo,
  Modal,
  Tooltip,
} from "../../../components";
import * as Icons from "../../../icons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { logout } from "../../../redux/slices/AccountSlice";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import Env from "../../../utils/env";
import { PWA_QUERY, useIsNarrowLayout, useMediaQuery } from "../../../utils/mediaQuery";
import Nav from "../../../utils/nav";
import { adminPagePath, settingsPagePath } from "../../../utils/router";
import Util from "../../../utils/util";
import { IssueReportEditor } from "../IssueReport/IssueReport";
import styles from "./Overview.module.scss";

type ModalName = "checkLogout" | "issueReport";

function Overview() {
  const email = useAppSelector((state) => state.account.email);
  const username = useAppSelector((state) => state.account.username);
  const avatarUrl = useAppSelector((state) => state.account.avatar_url);
  const isWaiting = useAppSelector((state) => state.account.isWaiting);
  const isSuperuser = useAppSelector((state) => state.account.is_superuser);
  const subscription = useAppSelector((state) => state.account.subscription);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isNarrowLayout = useIsNarrowLayout();
  // A new tab in the PWA would leave Taigu for the browser (PUB-R3).
  const legalPageTarget = useMediaQuery(PWA_QUERY) ? "_self" : "_blank";
  const [activeModalName, setActiveModalName] = useState<ModalName | null>(null);
  const [showDefaultAvatar, setShowDefaultAvatar] = useState(false);

  useLayoutEffect(() => {
    dispatch(updateHeaderTitle("設定"));
  }, [dispatch]);

  const hideModal = (): void => setActiveModalName(null);
  const handleClickIssueReport = (): void => {
    if (isNarrowLayout) {
      navigate(`${Env.frontendRootPath}${settingsPagePath}/issue-report`);
      return;
    }
    setActiveModalName("issueReport");
  };
  const handleClickCheckLogout = async (): Promise<void> => {
    await dispatch(logout()).unwrap();
    if (Nav.isAtLoginPage) return;
    navigate(`${Env.frontendRootPath}login`, { replace: true });

    // Push one more state because Modal will do navigate(-1) after submitting.
    window.history.pushState({}, "", `${Env.frontendRootPath}login`);
  };

  let activeModal: React.ReactNode = null;
  if (activeModalName === "issueReport") {
    activeModal = <IssueReportEditor hideModal={hideModal} />;
  } else if (activeModalName === "checkLogout") {
    activeModal = (
      <Modal
        title="登出"
        discardButtonProps={{
          children: "取消",
          variant: "transparent",
          onClick: hideModal,
        }}
        submitButtonProps={{
          children: "登出",
          variant: "primary",
          disabled: isWaiting,
          waiting: isWaiting,
          onClick: handleClickCheckLogout,
        }}
      >
        確定要登出嗎？
      </Modal>
    );
  }

  return (
    <>
      {activeModal}
      <div className={styles.main}>
        <BeautifulBlock id="account" title="帳號">
          <BeautifulRow
            onClick={() =>
              navigate(`${Env.frontendRootPath}${settingsPagePath}/user-info`)
            }
          >
            <div className={`${styles.row_inner} ${styles.user_info}`}>
              <div className={styles.avatar_container}>
                <img
                  className={styles.avatar}
                  src={
                    showDefaultAvatar
                      ? imgPersonFill
                      : (Util.validateAndSanitizeUrl(avatarUrl ?? "") ?? imgPersonFill)
                  }
                  alt=""
                  onError={() => setShowDefaultAvatar(true)}
                />
              </div>
              <div className={styles.username}>{username}</div>
            </div>
          </BeautifulRow>
          <BeautifulRow
            onClick={() =>
              navigate(`${Env.frontendRootPath}${settingsPagePath}/account-binding`)
            }
          >
            <div className={`${styles.row_inner} ${styles.email}`}>
              <Icons.IconEnvelope sideLength="16px" />
              <div className={styles.email_container}>
                <div>Email</div>
                <div>{email}</div>
              </div>
              <img src={googleLogo} alt="" className={styles.google_logo} />
            </div>
          </BeautifulRow>
          <BeautifulRow
            onClick={() =>
              navigate(`${Env.frontendRootPath}${settingsPagePath}/data-controls`)
            }
          >
            <div className={`${styles.row_inner} ${styles.terms_of_service}`}>
              <Icons.IconDatabaseManagement sideLength="16px" />
              資料控制
            </div>
          </BeautifulRow>
        </BeautifulBlock>
        <BeautifulBlock id="billing-and-plans" title="付款與方案">
          <BeautifulRow
            label="目前方案"
            onClick={() =>
              navigate(`${Env.frontendRootPath}${settingsPagePath}/current-plan`)
            }
          >
            {subscription.plan === "standard" ? "Standard" : "Free"}
          </BeautifulRow>
        </BeautifulBlock>
        <BeautifulBlock id="about" title="關於">
          <BeautifulRow
            onClick={() =>
              window.open(`${Env.frontendRootPath}privacy-policy`, legalPageTarget)
            }
          >
            <div className={`${styles.row_inner} ${styles.privacy_policy}`}>
              <Icons.IconIncognito sideLength="16px" />
              隱私權政策
            </div>
          </BeautifulRow>
          <BeautifulRow
            onClick={() =>
              window.open(`${Env.frontendRootPath}terms-of-service`, legalPageTarget)
            }
          >
            <div className={`${styles.row_inner} ${styles.terms_of_service}`}>
              <Icons.IconTermsInfo sideLength="16px" />
              服務條款
            </div>
          </BeautifulRow>
          <BeautifulRow onClick={handleClickIssueReport}>
            <div className={`${styles.row_inner} ${styles.issue_report}`}>
              <Icons.IconExclamation sideLength="16px" />
              問題回報
            </div>
          </BeautifulRow>
        </BeautifulBlock>
        {isSuperuser && (
          <BeautifulBlock id="admin" title="管理">
            <BeautifulRow
              onClick={() => navigate(`${Env.frontendRootPath}${adminPagePath}`)}
            >
              <div className={styles.row_inner}>
                <Icons.IconChartHistogram sideLength="16px" />
                後台
              </div>
            </BeautifulRow>
          </BeautifulBlock>
        )}
        <BeautifulBlock id="logout">
          <BeautifulRow onClick={() => setActiveModalName("checkLogout")}>
            <div className={`${styles.row_inner} ${styles.logout}`}>
              <Icons.IconExit sideLength="16px" />
              登出
            </div>
          </BeautifulRow>
        </BeautifulBlock>
        <div className={styles.copyright}>
          <Tooltip content="前往 Taigu 介紹頁" side="top">
            <Link
              to={`${Env.frontendRootPath}welcome`}
              className={styles.logo_link}
              aria-label="前往 Taigu 介紹頁"
            >
              <FullLogo size="m" />
            </Link>
          </Tooltip>
          Copyright {new Date().getFullYear()} Taigu All rights reserved.
        </div>
      </div>
    </>
  );
}

export default memo(Overview);
