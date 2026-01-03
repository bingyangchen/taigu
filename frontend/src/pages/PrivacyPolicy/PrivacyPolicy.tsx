import React from "react";
import { Link } from "react-router-dom";

import { FullLogo, RoundButton } from "../../components";
import { IconChevronLeft } from "../../icons";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./PrivacyPolicy.module.scss";

interface Props extends IRouter {}

interface State {}

class PrivacyPolicy extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return (
      <div className={styles.main}>
        <div className={styles.header}>
          {Util.isMobile && (
            <RoundButton
              className="p-12"
              hint_text="上一頁"
              onClick={() => this.props.router.navigate(-1)}
            >
              <IconChevronLeft sideLength="16" />
            </RoundButton>
          )}
          <Link to={Env.frontendRootPath}>
            <FullLogo size="m" />
          </Link>
          <h1>隱私權政策</h1>
        </div>
        <div className={styles.body}>
          <div className={styles.effective_date}>最後更新日期：2026/01/03</div>
          <h2>適用範圍</h2>
          <p>
            本隱私權政策適用於您在 Taigu
            網站（以下簡稱「本網站」）活動時，所涉及的個人資料蒐集、運用與保護，但不適用於與本網站以外的相關連結網站，也不適用於非本網站所委託或參與管理的人員。
          </p>
          <h2>個人資料之蒐集</h2>
          <p>
            本網站會蒐集您在使用本網站服務時所提供或產生的個人資料，包括但不限於：
            <ul>
              <li>您手動建立的交易紀錄、股利收益等資料。</li>
              <li>
                您在本網站使用第三方服務時所提供的資料，例如：您使用 Google
                登入本網站時所提供的 Google 帳號資料。
              </li>
            </ul>
          </p>
          <h2>個人資料之使用</h2>
          <p>
            本網站會將您的個人資料用於以下目的：
            <ul>
              <li>提供您本網站的服務。</li>
              <li>回應您的詢問或要求。</li>
              <li>與您聯繫，提供您最新的資訊或服務。</li>
            </ul>
          </p>
          <h2>個人資料之分享</h2>
          <p>
            本網站不會將您的個人資料分享給第三方，但有下列情形時，本網站得將您的個人資料分享給第三方：
            <ul>
              <li>您已事先同意。</li>
              <li>
                為提供您本網站的服務所必要，例如：本網站委託第三方提供客服或技術支援服務。
              </li>
              <li>為履行法律義務或司法程序所必要。</li>
              <li>為保護本網站或其他使用者的權益。</li>
            </ul>
          </p>
          <h2>個人資料之保護</h2>
          <p>
            本網站會採取適當的安全措施，以保護您的個人資料，包括：
            <ul>
              <li>使用防火牆、入侵偵測系統等技術措施，防止未經授權的存取。</li>
              <li>使用加密技術，確保您的個人資料傳輸的安全性。</li>
              <li>限制存取您的個人資料的人員。</li>
              <li>要求您的個人資料提供者採取適當的安全措施。</li>
            </ul>
          </p>
          <h2>您的權利</h2>
          <p>
            您有權查詢、閱覽、請求補充或更正、請求停止蒐集、處理或利用、請求刪除您的個人資料。您可以透過以下方式行使您的權利：
            <ul>
              <li>透過本網站的客服信箱提出申請。</li>
              <li>透過本網站所提供的聯絡方式與本網站聯繫。</li>
            </ul>
          </p>
          <h2>本政策之變更</h2>
          <p>
            本網站有權隨時修改本隱私權政策，並將最新的隱私權政策公布於本網站。您應該定期查看本網站的隱私權政策，以了解最新的隱私權政策內容。
          </p>
          <h2>聯絡我們</h2>
          <p>
            如果您對我們的隱私權政策有任何疑問或意見，請透過
            <a
              target="_blank"
              href="https://github.com/bingyangchen/taigu/issues"
              rel="noreferrer"
            >
              問題回報網頁
            </a>
            提出 ，或透過客服信箱 trade.smartly.official@gmail.com 聯絡我們。
          </p>
        </div>
      </div>
    );
  }
}

export default withRouter(PrivacyPolicy);
