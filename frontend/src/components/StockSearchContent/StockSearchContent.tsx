import { MouseEvent, MouseEventHandler, useEffect, useRef, useState } from "react";

import * as Icons from "../../icons";
import type { StockInfo } from "../../types";
import Api from "../../utils/api";
import { assertCurrentSession, getDocumentSessionVersion } from "../../utils/session";
import Util from "../../utils/util";
import DollarSign from "../DollarSign/DollarSign";
import RoundButton from "../RoundButton/RoundButton";
import SearchKeywordInput from "../SearchKeywordInput/SearchKeywordInput";
import styles from "./StockSearchContent.module.scss";

class StockSearchLRUCache {
  private readonly sessionVersion = getDocumentSessionVersion();
  private readonly CACHE_KEY = "stock_search_lru_cache";
  private readonly MAX_SIZE = 10;

  public add(sid: string): void {
    assertCurrentSession(this.sessionVersion);
    const cache = this.getAll();
    const filteredCache = cache.filter((cached) => cached !== sid);
    const newCache = [sid, ...filteredCache];
    const trimmedCache = newCache.slice(0, this.MAX_SIZE);
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(trimmedCache));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  public getAll(): string[] {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}

interface Props {
  variant: "dialog" | "page";
  onClose?: MouseEventHandler;
  onSelectStock: (sid: string, e: MouseEvent) => void;
}

export default function StockSearchContent({ variant, onClose, onSelectStock }: Props) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [completedSearchKeyword, setCompletedSearchKeyword] = useState<string | null>(
    null,
  );

  // The search responses arrive after later keystrokes, so they compare their keyword
  // with the latest one rather than with the keyword of the render that sent them.
  const searchKeywordRef = useRef("");
  const [stockSearchCache] = useState(() => new StockSearchLRUCache());
  const [stockSearch] = useState(() => {
    const showResults = (results: StockInfo[], keyword: string): void => {
      setSearchResults(results);
      setCompletedSearchKeyword(keyword);
    };
    const loadCachedItems = async (requestedKeyword = ""): Promise<void> => {
      const cachedSids = stockSearchCache.getAll();
      if (cachedSids.length === 0) {
        if (searchKeywordRef.current !== requestedKeyword) return;
        showResults([], requestedKeyword);
        return;
      }
      const stockInfoMap = await Api.sendRequest(
        `market/current-stock-info?sids=${cachedSids.join(",")}`,
        "get",
      );
      if (searchKeywordRef.current !== requestedKeyword) return;

      const stockInfoList: StockInfo[] = [];
      for (const sid of cachedSids) {
        const stockInfo = stockInfoMap[sid];
        if (stockInfo) stockInfoList.push(stockInfo);
      }
      showResults(stockInfoList, requestedKeyword);
    };
    const search = async (value: string): Promise<void> => {
      if (searchKeywordRef.current !== value) return;

      if (value.trim() === "") loadCachedItems(value);
      else {
        const response = await Api.sendRequest(`market/search?keyword=${value}`, "get");
        if (searchKeywordRef.current !== value) return;
        showResults(response.data, value);
      }
    };
    return { loadCachedItems, debouncedSearch: Util.debounce(search, 300) };
  });

  useEffect(() => {
    stockSearch.loadCachedItems();
  }, [stockSearch]);

  const handleClickResult = (e: MouseEvent, sid: string): void => {
    stockSearchCache.add(sid);
    onSelectStock(sid, e);
  };

  const searchInput = (
    <SearchKeywordInput
      placeholder="輸入證券代號或名稱"
      keyword={searchKeyword}
      autoFocus
      size="l"
      onChange={(keyword) => {
        searchKeywordRef.current = keyword;
        setSearchKeyword(keyword);
        stockSearch.debouncedSearch(keyword);
      }}
    />
  );

  const results =
    searchResults.length === 0 ? null : (
      <div className={styles.result}>
        {searchResults.map((stockInfo, idx) => {
          return (
            <div
              className={getRowClassName(stockInfo.fluct_price)}
              key={idx}
              onClick={(e) => handleClickResult(e, stockInfo.sid)}
            >
              <div className={styles.company}>
                <div className={styles.name}>{stockInfo.name}</div>
                <div className={styles.sid}>{stockInfo.sid}</div>
              </div>
              <div className={styles.price}>
                <div className={styles.price}>
                  <DollarSign />
                  {stockInfo.close}
                </div>
                <div className={styles.price_fluct}>
                  {`${
                    stockInfo.fluct_price > 0
                      ? "▲"
                      : stockInfo.fluct_price < 0
                        ? "▼"
                        : "-"
                  }
                  ${stockInfo.fluct_price !== 0 ? Math.abs(stockInfo.fluct_price) : ""}
                  ${
                    stockInfo.fluct_price !== 0
                      ? "(" +
                        (
                          Math.abs(stockInfo.fluct_price / stockInfo.close) * 100
                        ).toFixed(1) +
                        "%)"
                      : ""
                  }`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );

  if (variant === "page") {
    const hasCompletedKeyword =
      completedSearchKeyword !== null && completedSearchKeyword.trim().length > 0;
    return (
      <section className={styles.page}>
        <header className={styles.page_header}>
          <RoundButton aria-label="返回" size="l" onClick={onClose}>
            <Icons.IconChevronLeft sideLength="18" />
          </RoundButton>
          <div className={styles.page_search_input_outer}>{searchInput}</div>
        </header>
        {results ?? (
          <div className={styles.empty_state}>
            <div className={styles.empty_state_icon}>
              <Icons.IconMagnifier sideLength="24" />
            </div>
            <div className={styles.empty_state_text}>
              <div className={styles.empty_state_title}>
                {hasCompletedKeyword ? "找不到符合的股票" : "搜尋台股"}
              </div>
              <div className={styles.empty_state_description}>
                {hasCompletedKeyword
                  ? "請確認證券代號或名稱是否正確，或換個關鍵字再試一次。"
                  : "輸入證券代號或名稱，快速前往個股頁查看價格、持股與相關紀錄。"}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className={styles.dialog}>
      <div className={styles.search_input_outer}>{searchInput}</div>
      {results}
    </div>
  );
}

function getRowClassName(fluctPrice: number): string {
  return (
    styles.row +
    " " +
    (fluctPrice > 0 ? styles.red : fluctPrice < 0 ? styles.green : styles.gray)
  );
}
