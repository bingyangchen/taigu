import React from "react";
import { Link } from "react-router-dom";

import { FullLogo, RoundButton } from "../../components";
import { IconChevronLeft } from "../../icons";
import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./TermsOfService.module.scss";

interface Props extends IRouter {}

interface State {}

class TermsOfService extends React.Component<Props, State> {
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
          <h1>服務條款</h1>
        </div>
        <div className={styles.body}>
          <div className={styles.effective_date}>最後更新日期：2026/01/03</div>
          <h2>適用範圍</h2>
          <p>
            本服務條款適用於您在 Taigu
            網站（以下簡稱「本網站」）中使用服務時，所涉及的權利義務關係，但不適用於與本網站以外的相關連結網站，也不適用於非本網站所委託或參與管理的人員。
          </p>
          <h2>服務內容</h2>
          <p>
            本網站提供以下服務：
            <ul>
              <li>
                即時市場資訊：本網站會提供即時市場資訊，包括股票價格、成交量、漲跌幅等。
              </li>
              <li>紀錄：您可以透過本網站紀錄每一筆股票交易以及股利收益。</li>
              <li>
                資料視覺化：本網站會將您的交易歷史製作成方便您理解的各式圖表，但不會對外公開。
              </li>
              <li>
                資料匯出：您可以將您的交易歷史匯出為 JSON 檔案，方便您在其他地方使用。
              </li>
              <li>其他服務：本網站未來可能提供其他服務，相關服務內容將另行公告。</li>
            </ul>
          </p>
          <h2>使用條件</h2>
          <p>
            您使用本網站時，應遵守以下條件：
            <ul>
              <li>您應為合法且可獨立負擔民事責任之人。</li>
              <li>您應提供正確、完整且最新的個人資料。</li>
              <li>您應遵守本服務條款及相關法令規定。</li>
            </ul>
          </p>
          <h2>服務費用</h2>
          <p>
            部分服務可能需收取費用，您使用該等服務時，應依照本網站公告之費用支付方式及金額進行支付。
          </p>
          <h2>服務內容變更</h2>
          <p>
            本網站有權隨時修改本服務內容，並將最新的服務內容公告於本網站。您應該定期查看本網站的服務內容，以了解最新的服務內容。
          </p>
          <h2>帳號管理</h2>
          <p>
            您應妥善保管您的帳號，並負責帳號下的一切行為。您不得將帳號提供予第三人使用。若您使用第三方服務（如
            Google）登入本網站，您應妥善保管該第三方服務的帳號及密碼。
          </p>
          <h2>服務中斷或終止</h2>
          <p>
            本網站可能因系統維護、升級或其他原因而暫時中斷服務。若本網站決定永久終止服務，將盡可能提前通知您，並提供您匯出資料的機會。本網站保留隨時終止服務的權利。
          </p>
          <h2>責任限制</h2>
          <p>
            本網站會盡力提供穩定、安全的服務，但不保證服務不會中斷或發生錯誤。您同意本網站不因服務中斷或發生錯誤而負任何責任。
          </p>
          <h2>智慧財產權</h2>
          <p>
            本網站所使用的軟體、程式、文字、圖像、音樂、影片、資訊等，均屬於本網站或其授權人所有。您使用本網站時，不得侵害本網站或其授權人的智慧財產權。
          </p>
          <h2>爭議解決</h2>
          <p>
            您因使用本網站而與本網站發生爭議時，應先行友好協商解決。若協商不成，您得依據中華民國法律向法院提起訴訟。
          </p>
          <h2>其他規定</h2>
          <p>本服務條款如有未盡事宜，應依中華民國法律解釋及適用。</p>
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

export default withRouter(TermsOfService);
