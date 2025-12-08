import React from "react";
import { Link } from "react-router-dom";

import crossPlatform from "../../assets/cross-platform.png";
import demo01 from "../../assets/demo01.png";
import demo02 from "../../assets/demo02.png";
import demo03 from "../../assets/demo03.png";
import demo04 from "../../assets/demo04.png";
import demo05 from "../../assets/demo05.png";
import demo06 from "../../assets/demo06.png";
import demoInstantPrice from "../../assets/demo09.png";
import demoManyStocks from "../../assets/demomanystocks.mp4";
import logo from "../../assets/logo.png";
import { Button, FullLogo } from "../../components";
import { IconShieldCheck } from "../../icons";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./Welcome.module.scss";

interface Props {}

interface State {
  installPrompt: (Event & { prompt: Function }) | null;
  canInstallPWA: boolean;
  demoImageToShow: number;
  captionToShow: number;
  ballScale: number;
}

export default class Welcome extends React.Component<Props, State> {
  public state: State;
  private mainRef: React.RefObject<HTMLDivElement>;
  public constructor(props: Props) {
    super(props);
    this.state = {
      installPrompt: null,
      canInstallPWA: false,
      demoImageToShow: 0,
      captionToShow: 0,
      ballScale: 1,
    };
    this.mainRef = React.createRef();
  }
  public componentDidMount(): void {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.setState({
        installPrompt: e as Event & { prompt: Function },
        canInstallPWA: true,
      });
    });
    this.mainRef.current!.addEventListener("scroll", () => {
      const mainDiv = this.mainRef.current;
      if (mainDiv === null) return;
      this.setState({
        demoImageToShow: Math.min(
          5,
          Math.max(0, Math.floor((mainDiv.scrollTop * 2) / mainDiv.clientHeight) - 2),
        ),
        captionToShow: Math.min(
          2,
          Math.max(0, Math.floor(mainDiv.scrollTop / mainDiv.clientHeight) - 1),
        ),
        ballScale: this.getBallScale(
          Math.min(3.3, Math.max(0, mainDiv.scrollTop - 200) / mainDiv.clientHeight),
        ),
      });
    });
  }
  public render(): React.ReactNode {
    return (
      <main ref={this.mainRef} className={styles.main}>
        {Util.isMobile ? (
          <div className={styles.header}>
            <FullLogo size="m" />
            <div className={styles.ctas}>
              {this.state.canInstallPWA && !Util.isPWA ? (
                <Button className="primary_fill l" onClick={this.handleClickInstall}>
                  立即下載
                </Button>
              ) : (
                <Link to={`${Env.frontendRootPath}login`}>
                  <Button className="black l">搶先體驗</Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.cta_container}>
            <img src={logo} alt="" className={styles.logo} />
            <div className={styles.middle}>
              <div className={styles.top}>Taigu</div>
              <div className={styles.bottom}>專為台股設計，你的專業記帳幫手</div>
            </div>
            <Link to={`${Env.frontendRootPath}login`} className={styles.cta_button}>
              <Button className="white l">搶先體驗</Button>
            </Link>
          </div>
        )}
        <div className={`${styles.slide} ${styles.one}`}>
          <h1 className={styles.title}>Taigu：一款適合學生和上班族的股票記帳軟體</h1>
          <div className={styles.subtitle}>
            <h2>專為投資記帳而生</h2>
            <h2>帶你看見更全面的績效數據</h2>
          </div>
        </div>
        <div className={`${styles.slide} ${styles.two}`}>
          <div className={styles.left}>
            <div className={styles.inner}>
              <div className={styles.iphone}>
                <img src={demo01} alt="" className={this.getDemoImageClass(0)} />
                <img src={demo02} alt="" className={this.getDemoImageClass(1)} />
                <img src={demo03} alt="" className={this.getDemoImageClass(2)} />
                <img src={demo04} alt="" className={this.getDemoImageClass(3)} />
                <img src={demo05} alt="" className={this.getDemoImageClass(4)} />
                <img src={demo06} alt="" className={this.getDemoImageClass(5)} />
              </div>
              <div className={styles.ball_container}>
                <div
                  className={`${styles.ball} ${
                    [styles.blue, styles.yellow, styles.green][this.state.captionToShow]
                  }`}
                  style={{ transform: `scale(${this.state.ballScale})` }}
                />
              </div>
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.inner}>
              <div className={this.getCaptionClass(0)}>介面簡潔乾淨</div>
              <div className={this.getCaptionClass(1)}>圖表一目了然</div>
              <div className={this.getCaptionClass(2)}>操作流暢直覺</div>
            </div>
          </div>
        </div>
        <div className={`${styles.slide} ${styles.three}`}>
          <div className={styles.title}>
            <div className={styles.yellow}>即時股價，</div>
            <div>隨時掌握市場動態。</div>
          </div>
          <img src={demoInstantPrice} alt="" />
        </div>
        <div className={`${styles.slide} ${styles.four}`}>
          <div className={styles.container}>
            <div className={styles.title}>
              <div className={styles.red}>追蹤上千檔</div>
              <div>臺灣上市、上櫃、興櫃股票與 ETF</div>
            </div>
            <div className={styles.subtitle}>
              我們提供超過 2000 檔的臺灣上市、上櫃、興櫃股票與 ETF
              的資訊，讓您可以輕鬆追蹤和管理您的投資組合。
            </div>
          </div>
          <div className={styles.iphone}>
            <video
              className={styles.demo_video}
              src={demoManyStocks}
              autoPlay
              muted
              loop
            />
          </div>
        </div>
        <div className={`${styles.slide} ${styles.five}`}>
          <div className={styles.title}>
            <div className={styles.blue}>隨時隨地，</div>
            <div>跨裝置無縫接軌您的投資管理。</div>
          </div>
          <img src={crossPlatform} alt="" />
        </div>
        <div className={`${styles.slide} ${styles.six}`}>
          <IconShieldCheck sideLength="50" color="#1aa260" />
          <hr />
          <div className={styles.title}>保證安全</div>
          <div className={styles.subtitle}>
            我們以最高標準的加密技術和嚴謹的安全措施，您的每一筆交易資料我們皆全力守護。
          </div>
        </div>
        <div className={`${styles.slide} ${styles.seven}`}>
          <img src={logo} alt="" className={styles.logo} />
          <div className={styles.title_wrapper}>
            <h2 className={styles.title}>你該不會還在用 Excel 記錄投資績效吧？</h2>
            <h2 className={styles.title}>使用 Taigu 開始你嶄新的台股投資記帳體驗！</h2>
          </div>
          <Link to={`${Env.frontendRootPath}login`}>
            <Button className="white bold border xl">立即免費體驗</Button>
          </Link>
        </div>
        <footer className={styles.footer}>
          <div className={styles.logo_container}>
            <FullLogo size="m" />
          </div>
          <div className={styles.essential_links}>
            <Link to="/privacy-policy" target={Util.isMobile ? "_self" : "_blank"}>
              隱私權政策
            </Link>
            <Link to="/terms-of-service" target={Util.isMobile ? "_self" : "_blank"}>
              服務條款
            </Link>
            <Link
              to="https://github.com/bingyangchen/taigu"
              target={Util.isMobile ? "_self" : "_blank"}
            >
              開源程式碼
            </Link>
            <Link
              to="https://github.com/bingyangchen/taigu/issues"
              target={Util.isMobile ? "_self" : "_blank"}
            >
              問題回報
            </Link>
          </div>
          <hr />
          <div className={styles.copyright}>
            Copyright © Taigu 2021-{new Date().getFullYear()} All rights reserved
          </div>
        </footer>
      </main>
    );
  }
  private handleClickInstall = async (): Promise<void> => {
    if (!this.state.installPrompt) return;
    await this.state.installPrompt.prompt();
    this.setState({ installPrompt: null });
  };
  private getDemoImageClass = (number: number) => {
    return `${styles.demo_image} ${
      this.state.demoImageToShow >= number ? styles.show : ""
    }`;
  };
  private getCaptionClass = (number: number) => {
    return `${styles.caption} ${
      this.state.captionToShow === number ? styles.show : ""
    }`;
  };
  private getBallScale(x: number): number {
    return 2.5 * this.bluntCosine(Math.cos(x * 2.8), 4) + 3.5;
  }
  private bluntCosine(cos: number, b: number): number {
    // https://math.stackexchange.com/questions/100655/cosine-esque-function-with-flat-peaks-and-valleys
    return (
      cos * Math.sqrt((1 + Math.pow(b, 2)) / (1 + Math.pow(b, 2) * Math.pow(cos, 2)))
    );
  }
}
