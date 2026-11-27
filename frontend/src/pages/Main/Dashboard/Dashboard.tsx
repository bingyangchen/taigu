import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  DollarSign,
  MarketIndexSummary,
  MarketValuePieChart,
  PercentSign,
  SegmentedControl,
  SimpleCashInvestedLineChart,
  SpeedDial,
  SummaryCard,
  TradeRecordEditor,
} from "../../../components";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { changeDashboardDaysToShow } from "../../../redux/slices/MainPageSlice";
import { selectNetHandlingFee } from "../../../redux/slices/TradeRecordSlice";
import { dateStringToDate } from "../../../utils/date";
import Env from "../../../utils/env";
import { getSidMarketValueMap, getTotalMarketValue } from "../../../utils/market";
import { useIsNarrowLayout } from "../../../utils/mediaQuery";
import Util from "../../../utils/util";
import styles from "./Dashboard.module.scss";

function Dashboard() {
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  const stockWarehouse = useAppSelector((state) => state.tradeRecord.stockWarehouse);
  const totalCashInvested = useAppSelector(
    (state) => state.tradeRecord.totalCashInvested,
  );
  const sidGainMap = useAppSelector((state) => state.tradeRecord.sidGainMap);
  const cashInvestedChartData = useAppSelector(
    (state) => state.tradeRecord.cashInvestedChartData,
  );
  const cashDividendRecords = useAppSelector(
    (state) => state.cashDividend.cashDividendRecords,
  );
  const sidStockInfoMap = useAppSelector((state) => state.stockInfo.sidStockInfoMap);
  const handlingFeeDiscountRecords = useAppSelector(
    (state) => state.handlingFeeDiscount.handlingFeeDiscountRecords,
  );
  const dashboardDaysToShow = useAppSelector(
    (state) => state.mainPage.dashboardDaysToShow,
  );
  const netHandlingFee = useAppSelector(selectNetHandlingFee);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isNarrowLayout = useIsNarrowLayout();
  const [activeModalName, setActiveModalName] = useState<"createTradeRecord" | null>(
    null,
  );
  const [animatedTotalCashInvested, setAnimatedTotalCashInvested] = useState(0);

  // The total counts up to the cash invested, one step per animation frame.
  useEffect(() => {
    if (animatedTotalCashInvested === totalCashInvested) return;
    const animationFrameId = requestAnimationFrame(() =>
      setAnimatedTotalCashInvested((current) =>
        Math.min(
          current + Math.max(1, (totalCashInvested - current) / 2.5),
          totalCashInvested,
        ),
      ),
    );
    return () => cancelAnimationFrame(animationFrameId);
  }, [animatedTotalCashInvested, totalCashInvested]);

  // The charts are built only when their data changes, so the animation above does not
  // make ECharts redraw them on every frame.
  const cashInvestedLineChart = useMemo(() => {
    const allData = cashInvestedChartData.map((row) => ({
      date: dateStringToDate(row[0] as string),
      value: row[1] as number,
    }));
    const filteredData = allData.slice(-Math.min(dashboardDaysToShow, allData.length));
    return (
      <SimpleCashInvestedLineChart
        dates={filteredData.map((d) => d.date)}
        values={filteredData.map((d) => d.value)}
      />
    );
  }, [cashInvestedChartData, dashboardDaysToShow]);

  const sidMarketValueMap = useMemo(
    () => getSidMarketValueMap(sidStockInfoMap, stockWarehouse),
    [sidStockInfoMap, stockWarehouse],
  );
  const totalMarketValue = useMemo(
    () => getTotalMarketValue(sidStockInfoMap, stockWarehouse),
    [sidStockInfoMap, stockWarehouse],
  );
  const marketValuePieChart = useMemo(
    () => (
      <MarketValuePieChart
        sidMarketValueMap={sidMarketValueMap}
        totalMarketValue={totalMarketValue}
      />
    ),
    [sidMarketValueMap, totalMarketValue],
  );

  const xirr = useMemo(
    () =>
      Util.calculateXIRR(
        tradeRecords,
        handlingFeeDiscountRecords,
        cashDividendRecords,
        totalMarketValue,
      ),
    [tradeRecords, handlingFeeDiscountRecords, cashDividendRecords, totalMarketValue],
  );
  const totalEarning = useMemo(
    () =>
      Object.values(sidGainMap).reduce((sum, gain) => sum + gain, 0) +
      cashDividendRecords.reduce((sum, record) => sum + record.cash_dividend, 0),
    [sidGainMap, cashDividendRecords],
  );

  const handleCreateTradeRecordClick = (): void => {
    if (isNarrowLayout) {
      navigate(`${Env.frontendRootPath}records/trade/new`);
      return;
    }
    setActiveModalName("createTradeRecord");
  };

  return (
    <div className={styles.main}>
      <SpeedDial />
      <div className={styles.left}>
        <MarketIndexSummary />
        <div className={styles.lower}>
          <div className={styles.cash_invested_text}>
            <div className={styles.title}>投入金額</div>
            <div className={styles.cash_invested}>
              ${Math.round(animatedTotalCashInvested).toLocaleString()}
            </div>
          </div>
          <div className={styles.body}>
            {tradeRecords.length === 0 ? (
              <div className={styles.empty_section}>
                還沒有任何交易紀錄喔！快
                <span className={styles.button} onClick={handleCreateTradeRecordClick}>
                  點這裡
                </span>
                新增你的第一筆交易，展開投資之旅吧！
              </div>
            ) : (
              <>
                <div className={styles.cash_invested_chart_container}>
                  {cashInvestedLineChart}
                </div>
                <div className={styles.controls}>
                  <SegmentedControl
                    label="投入金額圖表時間區間"
                    options={[
                      { label: "1M", value: "30" },
                      { label: "1Q", value: "91" },
                      { label: "1Y", value: "365" },
                      { label: "ALL", value: "Infinity" },
                    ]}
                    value={String(dashboardDaysToShow)}
                    onChange={(value: string) =>
                      dispatch(
                        changeDashboardDaysToShow(
                          value === "Infinity" ? Infinity : Number(value),
                        ),
                      )
                    }
                  />
                  {/* <RoundButton size="l" hint_text="查看詳情">
                      <Icons.IconFullScreen sideLength="14" />
                    </RoundButton> */}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.upper}>
          <div className={styles.title}>投資組合</div>
          <div className={styles.market_value_chart_container}>
            {marketValuePieChart}
            <div className={styles.chart_center}>
              <div className={styles.upper}>目前市值</div>
              <div className={styles.lower}>
                <DollarSign />
                {Math.round(totalMarketValue).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        <SummaryCard title="年化報酬率">
          {tradeRecords.length > 0 ? (xirr * 100).toFixed(2) : 0}
          <PercentSign />
        </SummaryCard>
        <SummaryCard
          title="實現損益"
          onClick={() => navigate(`${Env.frontendRootPath}earning-analysis`)}
        >
          <DollarSign />
          {Math.round(totalEarning).toLocaleString()}
        </SummaryCard>
        <SummaryCard
          title="手續費用(-)"
          onClick={() => navigate(`${Env.frontendRootPath}handling-fee`)}
        >
          <DollarSign />
          {netHandlingFee.toLocaleString()}
        </SummaryCard>
      </div>
      {activeModalName === "createTradeRecord" && (
        <TradeRecordEditor hideModal={() => setActiveModalName(null)} />
      )}
    </div>
  );
}

export default memo(Dashboard);
