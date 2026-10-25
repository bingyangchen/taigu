import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button, SegmentedControl, Tooltip } from "../../../components";
import * as Icons from "../../../icons";
import { useAppDispatch } from "../../../redux/hooks";
import { pushToast } from "../../../redux/slices/ToastSlice";
import type {
  AdminIssueReport,
  IssueReportFilter,
  IssueReportHandledResponse,
  IssueReportsResponse,
  Platform,
} from "../../../types";
import Api from "../../../utils/api";
import { isNotFound, useOnLostAccess } from "../access";
import { LoadFailure, PageHead, SkeletonRows, StateMessage } from "../components";
import shared from "../components.module.scss";
import { formatTaiwanDateTime } from "../format";
import styles from "./IssueReports.module.scss";

const FILTER_OPTIONS = [
  { label: "未處理", value: "unhandled" },
  { label: "全部", value: "all" },
];
const PLATFORM_TO_LABEL: Record<Platform, string> = { web: "網頁", pwa: "PWA" };
const MARK_FAILED_MESSAGE = "無法更新這則問題回報，請稍後再試。";

type LoadStatus = "loading" | "loaded" | "failed";

interface Props {
  onUnhandledCountChange: (count: number) => void;
}

export default function IssueReports({
  onUnhandledCountChange,
}: Props): React.ReactElement {
  const dispatch = useAppDispatch();
  const onLostAccess = useOnLostAccess();
  const [filter, setFilter] = useState<IssueReportFilter>("unhandled");
  const filterRef = useRef(filter);
  const [reports, setReports] = useState<AdminIssueReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [moreStatus, setMoreStatus] = useState<LoadStatus>("loaded");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  // Read by clicks that land before the disabled button re-renders.
  const pendingIdsRef = useRef<Set<number>>(new Set());
  const latestRequestId = useRef(0);

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<IssueReportsResponse | undefined> => {
      const params = new URLSearchParams({ filter: filterRef.current });
      if (cursor) params.set("cursor", cursor);
      return await Api.sendRequest(`admin/issue-reports?${params}`, "get", undefined, {
        redirectOnNotFound: false,
      });
    },
    [],
  );

  const loadFirstPage = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequestId.current;
    setStatus("loading");
    setMoreStatus("loaded");
    try {
      const response = await fetchPage(null);

      // No response means Api is already taking the user to another page.
      if (!response || requestId !== latestRequestId.current) return;
      setReports(response.reports);
      setNextCursor(response.next_cursor);
      setStatus("loaded");
    } catch (error) {
      if (isNotFound(error)) onLostAccess();
      else if (requestId === latestRequestId.current) setStatus("failed");
    }
  }, [fetchPage, onLostAccess]);

  const loadMore = useCallback(async (): Promise<void> => {
    const requestId = latestRequestId.current;
    setMoreStatus("loading");
    try {
      const response = await fetchPage(nextCursor);
      if (!response || requestId !== latestRequestId.current) return;
      setReports((previous) => {
        const shownIds = new Set(previous.map((report) => report.id));
        return [
          ...previous,
          ...response.reports.filter((report) => !shownIds.has(report.id)),
        ];
      });
      setNextCursor(response.next_cursor);
      setMoreStatus("loaded");
    } catch (error) {
      if (isNotFound(error)) onLostAccess();
      else if (requestId === latestRequestId.current) setMoreStatus("failed");
    }
  }, [fetchPage, nextCursor, onLostAccess]);

  useEffect(() => {
    filterRef.current = filter;
    setExpandedIds(new Set());
    void loadFirstPage();
  }, [filter, loadFirstPage]);

  const toggleExpanded = (id: number): void => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const toggleHandled = async (report: AdminIssueReport): Promise<void> => {
    if (pendingIdsRef.current.has(report.id)) return;
    pendingIdsRef.current.add(report.id);
    setPendingIds(new Set(pendingIdsRef.current));
    try {
      const response = (await Api.sendRequest(
        `admin/issue-reports/${report.id}/handled`,
        "post",
        new URLSearchParams({ is_handled: String(!report.is_handled) }),
        // A report deleted with its reporter's account answers 404, which should
        // show the failure toast rather than leave the console.
        { silentOnFailure: true, redirectOnNotFound: false },
      )) as IssueReportHandledResponse | undefined;
      if (!response) return;
      const updated = response.report;
      setReports((previous) =>
        filterRef.current === "unhandled" && updated.is_handled
          ? previous.filter((each) => each.id !== updated.id)
          : previous.map((each) => (each.id === updated.id ? updated : each)),
      );
      onUnhandledCountChange(response.unhandled_count);
      dispatch(
        pushToast({
          type: "success",
          text: updated.is_handled ? "已標記為已處理。" : "已改回未處理。",
        }),
      );
    } catch {
      dispatch(pushToast({ type: "error", text: MARK_FAILED_MESSAGE }));
    } finally {
      pendingIdsRef.current.delete(report.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  };

  const filterControl = (
    <SegmentedControl
      label="篩選"
      options={FILTER_OPTIONS}
      value={filter}
      onChange={(value) => setFilter(value as IssueReportFilter)}
    />
  );

  return (
    <>
      <PageHead title="問題回報" tools={filterControl} />
      {status === "loading" && <SkeletonRows count={4} />}
      {status === "failed" && <LoadFailure onRetry={() => void loadFirstPage()} />}
      {status === "loaded" && reports.length === 0 && !nextCursor && (
        <StateMessage>
          {filter === "unhandled" ? "沒有未處理的問題回報。" : "還沒有人送出問題回報。"}
        </StateMessage>
      )}
      {status === "loaded" && reports.length > 0 && (
        <ul className={styles.reports}>
          {reports.map((report) => (
            <ReportItem
              key={report.id}
              report={report}
              isExpanded={expandedIds.has(report.id)}
              isPending={pendingIds.has(report.id)}
              onToggleExpanded={() => toggleExpanded(report.id)}
              onToggleHandled={() => void toggleHandled(report)}
            />
          ))}
        </ul>
      )}
      {status === "loaded" && moreStatus === "failed" && (
        <LoadFailure onRetry={() => void loadMore()} />
      )}
      {status === "loaded" && moreStatus !== "failed" && nextCursor && (
        <div className={styles.more}>
          <Button
            className={`white border s ${shared.touch_button}`}
            waiting={moreStatus === "loading"}
            onClick={() => void loadMore()}
          >
            載入更多
          </Button>
        </div>
      )}
    </>
  );
}

function ReportItem({
  report,
  isExpanded,
  isPending,
  onToggleExpanded,
  onToggleHandled,
}: {
  report: AdminIssueReport;
  isExpanded: boolean;
  isPending: boolean;
  onToggleExpanded: () => void;
  onToggleHandled: () => void;
}): React.ReactElement {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || isExpanded) return;

    // Whether the body exceeds 4 lines depends on the width it wraps at, so it is
    // measured on the rendered text.
    const measure = (): void =>
      setIsTruncated(body.scrollHeight > body.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [isExpanded, report.body]);

  const handleLabel = report.is_handled ? "改回未處理" : "標記為已處理";
  const expandLabel = isExpanded
    ? "收合"
    : isTruncated
      ? "展開全文與 User-Agent"
      : "顯示 User-Agent";

  return (
    <li className={`${styles.report} ${report.is_handled ? styles.handled : ""}`}>
      <div>
        <div className={styles.email}>{report.email}</div>
        <div className={styles.meta}>
          <span>
            {report.platform ? PLATFORM_TO_LABEL[report.platform] : "平台未記錄"}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={report.created_at}>
            {formatTaiwanDateTime(report.created_at)}
          </time>
        </div>
        <p
          ref={bodyRef}
          className={`${styles.body} ${isExpanded ? "" : styles.clamped}`}
        >
          {report.body}
        </p>
        {isExpanded && (
          <code className={styles.user_agent}>
            {report.user_agent ?? "User-Agent 未記錄"}
          </code>
        )}
        <button
          type="button"
          className={styles.expand_button}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          {expandLabel}
        </button>
      </div>
      <Tooltip content={handleLabel} side="left">
        <button
          type="button"
          className={`${styles.check} ${report.is_handled ? styles.checked : ""}`}
          aria-label={handleLabel}
          aria-busy={isPending || undefined}
          disabled={isPending}
          onClick={onToggleHandled}
        >
          <span className={styles.check_circle}>
            <Icons.IconCheck sideLength="12" />
          </span>
        </button>
      </Tooltip>
    </li>
  );
}
