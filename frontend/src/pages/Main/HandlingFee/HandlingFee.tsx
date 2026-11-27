import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React, {
  memo,
  MouseEventHandler,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Button,
  CheckDeleteModal,
  DeletePreview,
  DollarSign,
  HandlingFeeDiscountEditor,
  InfiniteScrollSentinel,
  ListRow,
  RoundButton,
  ScrollThresholdContainer,
  SegmentedControl,
  SpeedDial,
} from "../../../components";
import * as Icons from "../../../icons";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { deleteDiscount } from "../../../redux/slices/HandlingFeeDiscountSlice";
import { selectNetHandlingFee } from "../../../redux/slices/TradeRecordSlice";
import { COLORS, FONT_SIZES } from "../../../styles/tokens";
import type { HandlingFeeDiscount, TradeRecord } from "../../../types";
import Env from "../../../utils/env";
import { getDiscountTitle } from "../../../utils/handlingFeeDiscount";
import { navigateBack } from "../../../utils/router";
import Util from "../../../utils/util";
import { useListViewSaving, useSavedListView } from "../useListViewHistory";
import styles from "./HandlingFee.module.scss";

const TIME_SPAN_OPTIONS_IN_DAYS = [182, 365, 1825, Infinity];

function HandlingFee() {
  const netHandlingFee = useAppSelector(selectNetHandlingFee);
  const tradeRecords = useAppSelector((state) => state.tradeRecord.tradeRecords);
  const handlingFeeDiscountRecords = useAppSelector(
    (state) => state.handlingFeeDiscount.handlingFeeDiscountRecords,
  );
  const isWaitingDiscount = useAppSelector(
    (state) => state.handlingFeeDiscount.isWaiting,
  );
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const savedListView = useSavedListView();
  const [daysToShow, setDaysToShow] = useState(
    savedListView?.daysToShow ?? TIME_SPAN_OPTIONS_IN_DAYS[0],
  );
  const [numberToShow, setNumberToShow] = useState(savedListView?.numberToShow ?? 15);
  const [activeModalName, setActiveModalName] = useState<"discountModal" | null>(null);
  const [animatedHandlingFee, setAnimatedHandlingFee] = useState(0);
  useListViewSaving({ daysToShow, numberToShow });

  // The total counts up to the net handling fee: one step right away whenever the fee
  // changes, then one step every 30 ms.
  useLayoutEffect(() => {
    setAnimatedHandlingFee((current) => makeNextAnimatedFee(current, netHandlingFee));
  }, [netHandlingFee]);
  useEffect(() => {
    if (animatedHandlingFee === netHandlingFee) return;
    const timer = setTimeout(
      () =>
        setAnimatedHandlingFee((current) =>
          makeNextAnimatedFee(current, netHandlingFee),
        ),
      30,
    );
    return () => clearTimeout(timer);
  }, [animatedHandlingFee, netHandlingFee]);

  // Building the chart only when its data changes keeps ECharts from redrawing it on
  // every step of the animation above.
  const handlingFeeChart = useMemo(
    () => (
      <ReactECharts
        option={makeHandlingFeeChartOption(
          tradeRecords,
          handlingFeeDiscountRecords,
          daysToShow,
        )}
        style={{ height: "100%", width: "100%" }}
      />
    ),
    [tradeRecords, handlingFeeDiscountRecords, daysToShow],
  );

  const returnToDashboard = (): void => {
    navigateBack({ location, navigate }, Env.frontendRootPath);
  };
  const handleCreateDiscount = (): void => {
    if (Util.isMobile) {
      navigate(`${Env.frontendRootPath}handling-fee/discounts/new`);
      return;
    }
    setActiveModalName("discountModal");
  };

  const makeEditModal = (
    discount: HandlingFeeDiscount,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const EditModalComponent = (hideModal: MouseEventHandler) => {
      return <HandlingFeeDiscountEditor record={discount} hideModal={hideModal} />;
    };
    EditModalComponent.displayName = "EditModalComponent";
    return EditModalComponent;
  };

  const makeDeleteModal = (
    discount: HandlingFeeDiscount,
  ): ((_hideModal: MouseEventHandler) => React.ReactNode) => {
    const DeleteModalComponent = (hideModal: MouseEventHandler) => {
      return (
        <CheckDeleteModal
          hideModal={hideModal}
          title="刪除手續費折讓？"
          description="刪除後，這筆折讓不會再計入手續費分析。"
          submitLabel="刪除折讓紀錄"
          isWaiting={isWaitingDiscount}
          onDelete={async () => {
            await dispatch(deleteDiscount(discount.id)).unwrap();
          }}
        >
          <DeletePreview
            title={getDiscountTitle(discount.memo)}
            meta={discount.date}
            details={[
              {
                label: "折讓金額",
                value: (
                  <>
                    <DollarSign />
                    {discount.amount.toLocaleString()}
                  </>
                ),
              },
            ]}
          />
        </CheckDeleteModal>
      );
    };
    DeleteModalComponent.displayName = "DeleteModalComponent";
    return DeleteModalComponent;
  };

  return (
    <>
      {activeModalName === "discountModal" && (
        <HandlingFeeDiscountEditor hideModal={() => setActiveModalName(null)} />
      )}
      <div className={styles.main}>
        {Util.isMobile && <SpeedDial />}
        {Util.isMobile && (
          <ScrollThresholdContainer>
            {(isScrolled) => (
              <div
                className={`${styles.mobile_back_button_container} ${
                  isScrolled ? styles.scrolled : ""
                }`}
              >
                <RoundButton
                  onClick={returnToDashboard}
                  size="l"
                  frosted={isScrolled}
                  hint_text="回儀表板"
                >
                  <Icons.IconChevronLeft sideLength="16" />
                </RoundButton>
              </div>
            )}
          </ScrollThresholdContainer>
        )}
        <div className={styles.container}>
          {!Util.isMobile && (
            <div className={styles.desktop_back_button_container}>
              <RoundButton onClick={returnToDashboard} size="l" hint_text="回儀表板">
                <Icons.IconChevronLeft sideLength="16" />
              </RoundButton>
            </div>
          )}
          <div className={styles.left_block}>
            <div className={styles.handling_fee_section}>
              <div className={styles.title}>累積手續費</div>
              <div className={styles.total_handling_fee}>
                <DollarSign />
                {Math.round(animatedHandlingFee).toLocaleString()}
              </div>
            </div>
            {netHandlingFee > 0 ? (
              <div className={styles.chart_section}>
                <div className={styles.chart_container}>{handlingFeeChart}</div>
                <div className={styles.controls}>
                  <SegmentedControl
                    label="手續費圖表時間區間"
                    options={[
                      { label: "6M", value: "182" },
                      { label: "1Y", value: "365" },
                      { label: "5Y", value: "1825" },
                      { label: "ALL", value: "Infinity" },
                    ]}
                    value={String(daysToShow)}
                    onChange={(value: string) =>
                      setDaysToShow(value === "Infinity" ? Infinity : Number(value))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className={styles.hint}>
                手續費由交易紀錄產生，請先新增交易紀錄。
              </div>
            )}
          </div>
          <div className={styles.right_block}>
            <div className={styles.section_header}>
              <div className={styles.title}>手續費折讓</div>
              <Button variant="light" onClick={handleCreateDiscount}>
                新增折讓紀錄
              </Button>
            </div>
            {handlingFeeDiscountRecords.length === 0 ? (
              <div className={styles.empty_section}>目前沒有手續費折讓紀錄</div>
            ) : (
              <div className={styles.record_list} data-page-scroll>
                {handlingFeeDiscountRecords
                  .slice(0, numberToShow)
                  .map((discount: HandlingFeeDiscount) => (
                    <ListRow
                      key={discount.id}
                      target={discount}
                      editModal={makeEditModal(discount)}
                      deleteModal={makeDeleteModal(discount)}
                      editPath={`${Env.frontendRootPath}handling-fee/discounts/${discount.id}/edit`}
                    >
                      <span className={styles.company}>
                        {getDiscountTitle(discount.memo)}
                      </span>
                      <span className={styles.price}>
                        <DollarSign />
                        {discount.amount.toLocaleString()}
                      </span>
                      <span className={styles.date}>{discount.date}</span>
                    </ListRow>
                  ))}
                <InfiniteScrollSentinel
                  hasMore={handlingFeeDiscountRecords.length > numberToShow}
                  onLoadMore={() => setNumberToShow((count) => count * 2)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(HandlingFee);

function makeNextAnimatedFee(current: number, target: number): number {
  if (current === target) return current;
  return Math.min(current + Math.max(1, (target - current) / 2.5), target);
}

function makeHandlingFeeChartOption(
  tradeRecords: TradeRecord[],
  handlingFeeDiscountRecords: HandlingFeeDiscount[],
  daysToShow: number,
): EChartsOption {
  const monthlyData = getMonthlyHandlingFeeData(
    tradeRecords,
    handlingFeeDiscountRecords,
    daysToShow,
  );
  const months = monthlyData.map((item) => item.month);
  const values = monthlyData.map((item) => item.fee);
  const borderRadius = Math.max(1, Math.min(Math.floor(2500 / daysToShow), 10));
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const param = params[0];
        return `${param.name}<br/>${param.seriesName}: $${param.value.toLocaleString()}`;
      },
    },
    grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
    xAxis: {
      type: "category",
      data: months,
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        hideOverlap: true,
        formatter: (value: string) => {
          // value is in format "YYYY/MM", extract month directly instead of using new Date(value).getMonth() + 1
          const month = parseInt(value.split("/")[1], 10);
          return `${month}月`;
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.chartTick,
        formatter: (value: number) => {
          if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
          if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
          return value.toString();
        },
      },
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "手續費",
        type: "bar",
        data: values,
        itemStyle: { color: COLORS.chartAccent, borderRadius: borderRadius },
      },
    ],
    backgroundColor: "transparent",
  };
}

function getMonthlyHandlingFeeData(
  tradeRecords: TradeRecord[],
  handlingFeeDiscountRecords: HandlingFeeDiscount[],
  daysToShow: number,
): { month: string; fee: number }[] {
  const now = new Date();
  const cutoffDate = new Date();
  if (daysToShow !== Infinity) {
    cutoffDate.setDate(now.getDate() - daysToShow);
    cutoffDate.setDate(1); // Set to first day of the month
  } else {
    cutoffDate.setFullYear(2000, 0, 1);
  }

  const monthlyMap: { [month: string]: number } = {};

  tradeRecords.forEach((record) => {
    const recordDate = new Date(record.deal_time);
    if (recordDate >= cutoffDate) {
      const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + record.handling_fee;
    }
  });

  handlingFeeDiscountRecords.forEach((discount) => {
    const discountDate = new Date(discount.date);
    if (discountDate >= cutoffDate) {
      const monthKey = `${discountDate.getFullYear()}-${String(discountDate.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) - discount.amount;
    }
  });

  const result = Object.entries(monthlyMap)
    .map(([month, fee]) => ({
      month: `${month.split("-")[0]}/${month.split("-")[1]}`,
      fee,
    }))
    .sort((a, b) => {
      const [yearA, monthA] = a.month.split("/").map(Number);
      const [yearB, monthB] = b.month.split("/").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

  return result;
}
