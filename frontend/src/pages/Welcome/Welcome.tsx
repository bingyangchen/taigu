import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import dashboardWide from "../../assets/welcome/dashboard-wide.webp";
import stockDetailsWide from "../../assets/welcome/stock-details-wide.webp";
// Not through ../../components, which loads the store: src/prerender.tsx renders
// this page in Node.
import Button from "../../components/Button/Button";
import FullLogo from "../../components/FullLogo/FullLogo";
import PageMeta from "../../components/PageMeta/PageMeta";
import Tooltip from "../../components/Tooltip/Tooltip";
import * as Icons from "../../icons";
import Env from "../../utils/env";
import { useIsPWA } from "../../utils/mediaQuery";
import DetailsCarousel from "./DetailsCarousel/DetailsCarousel";
import FeatureStory from "./FeatureStory/FeatureStory";
import LaptopFrame from "./LaptopFrame/LaptopFrame";
import PhoneFrame, { PhoneScreenshot } from "./PhoneFrame/PhoneFrame";
import { SCREENS } from "./screens";
import SpreadsheetMock from "./SpreadsheetMock/SpreadsheetMock";
import styles from "./Welcome.module.scss";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const LOGIN_PATH = `${Env.frontendRootPath}login`;

// How far the page scrolls before the navigation bar shows its bottom border.
const NAV_BORDER_SCROLL_OFFSET = 8;

const STANDARD_BENEFITS: ReactNode[] = [
  "交易紀錄與現金股利不限筆數",
  "買賣計畫不限筆數",
  "持股與關注不限檔數",
  <>
    股價約每 <strong>30 秒</strong>更新
  </>,
];

const FREE_MONTHLY_LIMITS: ReactNode[] = [
  <>
    交易紀錄 + 現金股利：<strong>20 筆</strong>
  </>,
  <>
    買賣計畫：<strong>10 筆</strong>
  </>,
];

const FREE_TRACKING_LIMITS: ReactNode[] = [
  <>
    持股：<strong>10 檔</strong>
  </>,
  <>
    關注：<strong>10 檔</strong>
  </>,
  <>
    股價約每 <strong>10 分鐘</strong>更新
  </>,
];

const TRUST_POINTS = [
  { title: "用 Google 帳號登入", description: "不必再多記一組密碼。" },
  { title: "不連結券商", description: "不會要你的券商帳號或密碼，也不能幫你下單。" },
  {
    title: "不給投資建議",
    description: "不推薦股票，也不報明牌，數字怎麼解讀由你決定。",
  },
  { title: "紀錄隨時帶走", description: "交易紀錄與現金股利紀錄都能匯出成檔案。" },
];

const DEVICE_FACTS = [
  { title: "行動版", description: "單手就能記帳、查行情" },
  { title: "桌面版", description: "寬螢幕並排更多資訊" },
  { title: "資料同步", description: "換台裝置也看得到" },
  { title: "安裝成 App", description: "加到手機主畫面或電腦" },
];

const SPREADSHEET_FIXES = [
  { title: "行情自動更新", description: "持股市值不必再手動貼股價。" },
  { title: "手續費自動試算", description: "賣出時連證交稅一起算。" },
  { title: "年化報酬率自動計算", description: "不用自己寫公式。" },
];

const SOCIAL_LINKS = [
  {
    href: "https://www.instagram.com/taigu.tw/",
    label: "Taigu 的 Instagram",
    icon: <Icons.IconInstagram sideLength="20" />,
  },
  {
    href: "https://www.facebook.com/profile.php?id=61596233455195",
    label: "Taigu 的 Facebook 粉絲專頁",
    icon: <Icons.IconFacebook sideLength="20" />,
  },
];

function CheckList({ items }: { items: ReactNode[] }) {
  return (
    <ul className={styles.check_list}>
      {items.map((item, index) => (
        <li key={index}>
          <Icons.IconCheck sideLength="12" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Welcome(): React.ReactElement {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  // The page scrolls inside <main>, because <body> does not scroll in this app.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const handleScroll = (): void =>
      setIsScrolled(main.scrollTop > NAV_BORDER_SCROLL_OFFSET);
    handleScroll();
    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  const isPWA = useIsPWA();
  const canInstallPWA = installPrompt !== null && !isPWA;

  // A new tab in the PWA would leave Taigu for the browser (PUB-R3).
  const legalLinkTarget = isPWA ? "_self" : "_blank";

  const handleInstall = async (): Promise<void> => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  // The navigation bar and the calls to action install Taigu when the browser offers
  // to, and otherwise lead to the login page, where the first sign-in creates the
  // account.
  const renderInstallOrLogin = (loginLabel: string, installLabel: string) =>
    canInstallPWA ? (
      <Button
        variant="primary_fill"
        size="l"
        round
        className={styles.cta}
        onClick={handleInstall}
      >
        {installLabel}
      </Button>
    ) : (
      <Button variant="primary_fill" size="l" round className={styles.cta} asChild>
        <Link to={LOGIN_PATH}>{loginLabel}</Link>
      </Button>
    );

  return (
    <main ref={mainRef} className={styles.main}>
      <PageMeta
        title="Taigu | 台股記帳 | 專業投資組合管理，精準損益計算與績效追蹤"
        description="Taigu 是專業的台股投資記帳工具，提供直覺操作、清晰圖表與完整績效分析。支援網頁版與 App，跨平台同步，讓你在手機、平板、電腦隨時掌握投資狀況，輕鬆管理台股投資組合！"
        canonicalPath="/welcome"
      />

      <header className={`${styles.nav} ${isScrolled ? styles.scrolled : ""}`}>
        <div className={styles.nav_inner}>
          <a href="#top" className={styles.logo_link} aria-label="回到頁首">
            <FullLogo size="m" />
          </a>
          <nav aria-label="歡迎頁">
            <ul className={styles.nav_links}>
              <li>
                <a href="#features">功能</a>
              </li>
              <li>
                <a href="#pricing">方案</a>
              </li>
            </ul>
          </nav>
          {renderInstallOrLogin("登入", "安裝")}
        </div>
      </header>

      {/* The logo scrolls back here. The target is the hero, not the sticky header,
          which already sits at the top of the scroll area once the page scrolls. */}
      <section id="top" className={styles.hero} aria-labelledby="welcome-title">
        <div className={styles.hero_copy}>
          <h1 id="welcome-title">
            你的投資，
            <br />
            不靠感覺。
          </h1>
          <p className={styles.lead}>
            Taigu
            是專為台股設計的投資記帳工具。記下買賣與現金股利，持股、損益和年化報酬率就自動算好，不必再維護
            Excel。
          </p>
          <div className={styles.hero_actions}>
            {renderInstallOrLogin("開始免費使用", "安裝 Taigu")}
            <a className={styles.text_link} href="#pricing">
              查看方案
              <Icons.IconChevronRight sideLength="11" />
            </a>
          </div>
          <p className={styles.hero_note}>
            新帳號可以免費試用{" "}
            <span className={styles.nowrap}>Standard 方案一個月</span>。
          </p>
        </div>

        <div className={styles.hero_stage}>
          <LaptopFrame
            src={dashboardWide}
            alt="Taigu 在電腦上的畫面：投入金額的走勢圖、持股配置的圓餅圖與年化報酬率"
            isWideOnlyPriority
            className={styles.hero_laptop}
          />
          <PhoneFrame priority className={styles.hero_phone}>
            <PhoneScreenshot
              screen={SCREENS.dashboard}
              wideScreen={SCREENS.holdings}
              alt="Taigu 在手機上的畫面：持股與投入金額的走勢"
              priority
            />
          </PhoneFrame>
        </div>
        <p className={styles.hero_caption}>畫面為示意，帳戶與交易資料皆為虛構。</p>
      </section>

      <section
        className={`${styles.section} ${styles.tinted}`}
        aria-labelledby="spreadsheet-title"
      >
        <div className={styles.spreadsheet}>
          <div className={styles.section_intro}>
            <h2 id="spreadsheet-title">還在用 Excel 記股票？</h2>
            <p className={styles.lead}>
              每筆交易手動輸入、手續費自己算、股價天天複製貼上，XIRR 公式一改就跳出
              #NUM!。這些事，交給 Taigu。
            </p>
          </div>
          <div className={styles.spreadsheet_stage}>
            <SpreadsheetMock className={styles.spreadsheet_mock} />
            <PhoneFrame className={styles.spreadsheet_phone}>
              <PhoneScreenshot
                screen={SCREENS.records}
                alt="Taigu 的紀錄列表：買進與股利依日期排好，每筆都有成交價或入帳金額"
              />
            </PhoneFrame>
          </div>
          <ul className={styles.spreadsheet_fixes}>
            {SPREADSHEET_FIXES.map((fix) => (
              <li key={fix.title}>
                <Icons.IconCheck sideLength="14" />
                <span>
                  <strong>{fix.title}</strong>，{fix.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="features"
        className={styles.section}
        aria-labelledby="features-title"
      >
        <h2 id="features-title" className={styles.visually_hidden}>
          功能
        </h2>
        <div className={styles.wrap}>
          <FeatureStory />
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.dark}`}
        aria-labelledby="devices-title"
      >
        <div className={styles.wrap}>
          <div className={styles.section_intro}>
            <h2 id="devices-title">到哪裡都能記。</h2>
            <p className={styles.lead}>
              Taigu
              有為手機設計的行動版，也有為大螢幕設計的桌面版。在手機上新增的紀錄，打開電腦就看得到。
            </p>
          </div>
          <div className={styles.devices_stage}>
            <LaptopFrame
              src={stockDetailsWide}
              alt="電腦上的台積電頁面：最近一年的收盤價走勢、投資摘要與庫存分佈並排"
              className={styles.devices_laptop}
            />
            <PhoneFrame className={styles.devices_phone}>
              <PhoneScreenshot
                screen={SCREENS.stockDetails}
                alt="手機上的台積電頁面：價格與最近一年的收盤價走勢"
              />
            </PhoneFrame>
          </div>
          <ul className={styles.device_facts}>
            {DEVICE_FACTS.map((fact) => (
              <li key={fact.title}>
                <strong>{fact.title}</strong>
                {fact.description}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="details-title">
        <div className={styles.wrap}>
          <h2 id="details-title">
            小地方，
            <br />
            也替你想好了。
          </h2>
        </div>
        <DetailsCarousel labelledBy="details-title" />
      </section>

      <section
        className={`${styles.section} ${styles.tinted}`}
        aria-labelledby="trust-title"
      >
        <div className={styles.wrap}>
          <div className={styles.section_intro}>
            <h2 id="trust-title">
              只記帳，
              <br />
              不碰你的錢。
            </h2>
            <p className={styles.lead}>Taigu 只幫你記錄和計算，不經手任何一筆交易。</p>
          </div>
          <ul className={styles.trust_points}>
            {TRUST_POINTS.map((point) => (
              <li key={point.title}>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
        <div className={styles.wrap}>
          <div className={styles.section_intro}>
            <h2 id="pricing-title">
              免費開始，
              <br />
              隨時升級。
            </h2>
            <p className={styles.lead}>
              新帳號可以免費試用{" "}
              <span className={styles.nowrap}>Standard 方案一個月</span>
              。試用結束後改用 Free 方案，已經記下的紀錄都會保留。
            </p>
          </div>

          <div className={styles.plans}>
            <article
              className={`${styles.plan} ${styles.plan_featured}`}
              aria-labelledby="plan-standard"
            >
              <h3 id="plan-standard">Standard</h3>
              <p className={styles.plan_summary}>完整記錄你的台股投資。</p>
              <div className={styles.price}>
                <p className={styles.price_main}>
                  <span>NT$65</span>
                  <small>/月</small>
                </p>
                <p className={styles.price_alternative}>
                  或 NT$700 / 年，<strong>省 NT$80</strong>
                </p>
              </div>
              <Button
                variant="primary_fill"
                size="l"
                round
                className={`${styles.cta} ${styles.plan_action}`}
                asChild
              >
                <Link to={LOGIN_PATH}>開始免費試用</Link>
              </Button>
              <div className={styles.plan_groups}>
                <CheckList items={STANDARD_BENEFITS} />
              </div>
            </article>

            <article className={styles.plan} aria-labelledby="plan-free">
              <h3 id="plan-free">Free</h3>
              <p className={styles.plan_summary}>先記少量紀錄，熟悉 Taigu。</p>
              <div className={styles.price}>
                <p className={styles.price_main}>
                  <span>NT$0</span>
                </p>
                <p className={styles.price_alternative}>不用綁定付款方式</p>
              </div>
              <Button
                variant="light"
                size="l"
                round
                className={`${styles.cta} ${styles.plan_action}`}
                asChild
              >
                <Link to={LOGIN_PATH}>免費開始</Link>
              </Button>
              <div className={styles.plan_groups}>
                <div>
                  <h4>每月新增</h4>
                  <CheckList items={FREE_MONTHLY_LIMITS} />
                </div>
                <div>
                  <h4>同時追蹤</h4>
                  <CheckList items={FREE_TRACKING_LIMITS} />
                </div>
              </div>
            </article>
          </div>
          <p className={styles.plans_note}>
            改用 Free 方案時，超過額度的部分只是不能再新增，既有的紀錄不會被刪除。
          </p>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.closing}`}
        aria-labelledby="closing-title"
      >
        <div className={styles.closing_copy}>
          <h2 id="closing-title">今天，就記下第一筆。</h2>
          <p className={styles.lead}>手機和電腦都能用，用 Google 帳號登入就能開始。</p>
          {renderInstallOrLogin("開始免費使用", "安裝 Taigu")}
        </div>
        <div className={styles.closing_peek} aria-hidden="true">
          <PhoneFrame className={styles.closing_phone}>
            <PhoneScreenshot screen={SCREENS.dashboard} alt="" />
          </PhoneFrame>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footer_top}>
          <FullLogo size="s" />
          <ul className={styles.footer_links}>
            <li>
              <Link to="/privacy-policy" target={legalLinkTarget}>
                隱私權政策
              </Link>
            </li>
            <li>
              <Link to="/terms-of-service" target={legalLinkTarget}>
                服務條款
              </Link>
            </li>
            <li>
              <a href="mailto:taigu.tw@gmail.com">taigu.tw@gmail.com</a>
            </li>
          </ul>
          <ul className={styles.social_links}>
            {SOCIAL_LINKS.map((link) => (
              <li key={link.label}>
                <Tooltip content={link.label} side="top">
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                  >
                    {link.icon}
                  </a>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
        <p>
          本頁畫面為示意，畫面中的帳戶與交易資料皆為虛構。Taigu
          提供的行情與計算結果僅供記錄參考，不構成投資建議。
        </p>
        <p>Copyright © Taigu 2021-{new Date().getFullYear()} All rights reserved</p>
      </footer>
    </main>
  );
}
