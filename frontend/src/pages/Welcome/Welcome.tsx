import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import crossPlatform from "../../assets/cross_platform.webp";
import demoManyStocks from "../../assets/demo.mp4";
import demo01 from "../../assets/demo01.webp";
import demo02 from "../../assets/demo02.webp";
import demo03 from "../../assets/demo03.webp";
import demo04 from "../../assets/demo04.webp";
import demo05 from "../../assets/demo05.webp";
import demo06 from "../../assets/demo06.webp";
import realtimeInfo from "../../assets/realtime_info.webp";
import { FullLogo } from "../../components";
import {
  IconAppAdd,
  IconChartHistogram,
  IconClockHistory,
  IconDatabaseManagement,
  IconShieldCheck,
} from "../../icons";
import Env from "../../utils/env";
import Util from "../../utils/util";
import styles from "./Welcome.module.scss";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const featureHighlights = [
  {
    title: "交易與股利一次記好",
    description:
      "買進、賣出、現金股利與手續費都回到同一份紀錄，不必再維護分散的試算表。",
    icon: <IconDatabaseManagement sideLength="22" />,
  },
  {
    title: "績效圖表直接回答問題",
    description: "快速看懂投入成本、市值、已實現損益、年化報酬與股利貢獻。",
    icon: <IconChartHistogram sideLength="22" />,
  },
  {
    title: "市場資訊貼近台股習慣",
    description: "支援上市、上櫃、興櫃與 ETF，追蹤持股、最愛清單與即時行情。",
    icon: <IconClockHistory sideLength="22" />,
  },
];

const workflowItems = [
  { label: "新增交易紀錄", value: "30 秒" },
  { label: "追蹤持股與最愛", value: "2000+ 檔" },
  { label: "分析現金股利", value: "自動彙整" },
];

const demoImages = [demo01, demo02, demo03, demo04, demo05, demo06];

export default function Welcome(): React.ReactElement {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const canInstallPWA = installPrompt !== null && !Util.isPWA;
  const primaryActionLabel = canInstallPWA ? "安裝 Taigu" : "開始免費使用";

  const handlePrimaryAction = async (): Promise<void> => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link to={`${Env.frontendRootPath}welcome`} className={styles.logoLink}>
          <FullLogo size="m" />
        </Link>
        <nav className={styles.nav} aria-label="Welcome page navigation">
          <a href="#workflow">功能</a>
          <a href="#market">台股資料</a>
          <a href="#trust">安全性</a>
        </nav>
        {canInstallPWA ? (
          <button className={styles.headerAction} onClick={handlePrimaryAction}>
            安裝
          </button>
        ) : (
          <Link to={`${Env.frontendRootPath}login`} className={styles.headerAction}>
            登入
          </Link>
        )}
      </header>

      <section className={styles.hero} aria-labelledby="welcome-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>專為台股投資記帳打造</p>
          <h1 id="welcome-title">
            <span>把交易、股利與績效，</span>
            <span>整理成每天看得懂的</span>
            <span>投資工作台。</span>
          </h1>
          <p className={styles.heroDescription}>
            Taigu 讓台股投資者告別
            Excel：快速記錄交易與現金股利，追蹤持股與最愛股票，並用清楚圖表掌握自己的投資表現。
          </p>
          <div className={styles.heroActions}>
            {canInstallPWA ? (
              <button className={styles.primaryAction} onClick={handlePrimaryAction}>
                {primaryActionLabel}
              </button>
            ) : (
              <Link
                to={`${Env.frontendRootPath}login`}
                className={styles.primaryAction}
              >
                {primaryActionLabel}
              </Link>
            )}
            <a href="#workflow" className={styles.secondaryAction}>
              看看怎麼管理
            </a>
          </div>
          <dl className={styles.heroStats}>
            {workflowItems.map((item) => (
              <div key={item.label}>
                <dt>{item.value}</dt>
                <dd>{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.productStage} aria-label="Taigu app preview">
          <div className={styles.screenCluster}>
            <img className={styles.primaryScreen} src={demo01} alt="Taigu 儀表板畫面" />
            <img
              className={styles.secondaryScreen}
              src={demo05}
              alt="Taigu 績效分析畫面"
            />
          </div>
        </div>
      </section>

      <section id="workflow" className={styles.workflowSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>從記錄到判斷</p>
          <h2>核心工作流不多，但每一步都要快。</h2>
          <p>
            Welcome page 的責任不是把功能全列完，而是讓新使用者立即理解：Taigu
            是台股投資紀錄的日常工具，不是券商、不給投資建議，只把你的資料整理清楚。
          </p>
        </div>
        <div className={styles.featureGrid}>
          {featureHighlights.map((feature) => (
            <article className={styles.feature} key={feature.title}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.showcaseSection}>
        <div className={styles.showcaseCopy}>
          <p className={styles.eyebrow}>一眼看懂績效</p>
          <h2>用資料視角管理投資，而不是整理表格。</h2>
          <p>
            儀表板、損益分析、庫存分布與交易明細保持在同一套語言裡。當你新增一筆紀錄，後面的圖表與摘要就能跟著更新。
          </p>
        </div>
        <div className={styles.demoRail} aria-label="Taigu feature screenshots">
          {demoImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt={`Taigu 功能畫面 ${index + 1}`}
              className={index % 2 === 0 ? styles.raisedDemo : undefined}
            />
          ))}
        </div>
      </section>

      <section id="market" className={styles.marketSection}>
        <div className={styles.marketVisual}>
          <img src={realtimeInfo} alt="Taigu 即時市場資訊畫面" />
        </div>
        <div className={styles.marketCopy}>
          <p className={styles.eyebrow}>台股資料脈絡</p>
          <h2>股票、ETF、持股與最愛清單，放在同一個市場視圖。</h2>
          <p>
            找證券代號、看即時資訊、追蹤重大訊息與個人筆記，都用投資者熟悉的台股語彙呈現，少一層轉換成本。
          </p>
          <div className={styles.inlinePreview}>
            <video src={demoManyStocks} autoPlay muted loop playsInline />
            <span>快速搜尋與追蹤上千檔台股標的</span>
          </div>
        </div>
      </section>

      <section id="trust" className={styles.trustSection}>
        <div className={styles.trustCopy}>
          <IconShieldCheck sideLength="34" />
          <h2>你的投資紀錄應該清楚，也應該被妥善保護。</h2>
          <p>
            Taigu 使用 Google
            登入與伺服器端帳戶資料邊界，讓交易紀錄、股利與個人設定能跨裝置延續，同時保持資料歸屬清楚。
          </p>
        </div>
        <div className={styles.devicePanel}>
          <img src={crossPlatform} alt="Taigu 跨裝置使用示意" />
        </div>
      </section>

      <section className={styles.finalCta}>
        <IconAppAdd sideLength="34" />
        <h2>今天開始，用一個安靜但完整的地方管理台股紀錄。</h2>
        <p>先記下一筆交易，讓 Taigu 幫你把績效、股利和持股脈絡整理起來。</p>
        {canInstallPWA ? (
          <button className={styles.primaryAction} onClick={handlePrimaryAction}>
            安裝 Taigu
          </button>
        ) : (
          <Link to={`${Env.frontendRootPath}login`} className={styles.primaryAction}>
            開始免費使用
          </Link>
        )}
      </section>

      <footer className={styles.footer}>
        <FullLogo size="m" />
        <div className={styles.footerLinks}>
          <Link to="/privacy-policy" target={Util.isMobile ? "_self" : "_blank"}>
            隱私權政策
          </Link>
          <Link to="/terms-of-service" target={Util.isMobile ? "_self" : "_blank"}>
            服務條款
          </Link>
          <Link to="https://github.com/bingyangchen/taigu" target="_blank">
            開源程式碼
          </Link>
          <Link to="https://github.com/bingyangchen/taigu/issues" target="_blank">
            問題回報
          </Link>
        </div>
        <p>Copyright © Taigu 2021-{new Date().getFullYear()} All rights reserved</p>
      </footer>
    </main>
  );
}
