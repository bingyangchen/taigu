import { memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { FullLogo, NavTab, RoundButton } from "../../components";
import * as Icons from "../../icons";
import { Subpage } from "../../types";
import Env from "../../utils/env";
import styles from "./SettingsSideBar.module.scss";

interface Props {
  subpages: Subpage[];
}

function SettingsSideBar({ subpages }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <RoundButton
          size="l"
          hint_text="回首頁"
          onClick={() => navigate(`${Env.frontendRootPath}`, { replace: true })}
        >
          <Icons.IconChevronLeft sideLength="16" />
        </RoundButton>
        帳號與設定
      </div>
      <div className={styles.subpage_list}>
        {subpages.map((subpage, idx) => {
          return (
            <NavTab
              page={subpage}
              onClick={() => scrollDivIntoView(subpage.path)}
              key={idx}
              replace
              isCustomActive={location.hash === subpage.path}
            />
          );
        })}
      </div>
      <div className={styles.footer}>
        <div className={styles.logo_outer}>
          <FullLogo size="s" />
        </div>
        <div className={styles.copyright}>© Taigu 2021-{new Date().getFullYear()}</div>
      </div>
    </div>
  );
}

export default memo(SettingsSideBar);

function scrollDivIntoView(hash: string): void {
  document
    .getElementById(hash.replaceAll("#", ""))
    ?.scrollIntoView({ behavior: "smooth" });
}
