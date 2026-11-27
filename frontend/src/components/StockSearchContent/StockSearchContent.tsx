import {
  KeyboardEvent,
  MouseEventHandler,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import * as Icons from "../../icons";
import type { StockInfo } from "../../types";
import Api from "../../utils/api";
import { getNextHighlightedIndex, isImeComposing } from "../../utils/keyboard";
import { assertCurrentSession, getDocumentSessionVersion } from "../../utils/session";
import { useScrollIntoViewAfterCommit } from "../../utils/useScrollIntoViewAfterCommit";
import Util from "../../utils/util";
import DollarSign from "../DollarSign/DollarSign";
import RoundButton from "../RoundButton/RoundButton";
import SearchKeywordInput from "../SearchKeywordInput/SearchKeywordInput";
import { formatStockChange } from "../stockPriceFormat";
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
  onSelectStock: (sid: string) => void;
}

export default function StockSearchContent({ variant, onClose, onSelectStock }: Props) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [completedSearchKeyword, setCompletedSearchKeyword] = useState<string | null>(
    null,
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listboxId = useId();
  const getOptionId = (index: number): string => `${listboxId}-option-${index}`;
  const scrollIntoViewAfterCommit = useScrollIntoViewAfterCommit();

  // The search responses arrive after later keystrokes, so they compare their keyword
  // with the latest one rather than with the keyword of the render that sent them.
  const searchKeywordRef = useRef("");
  const [stockSearchCache] = useState(() => new StockSearchLRUCache());
  const [stockSearch] = useState(() => {
    const showResults = (results: StockInfo[], keyword: string): void => {
      setSearchResults(results);
      setCompletedSearchKeyword(keyword);

      // The dialog highlights the first stock so that Enter opens it at once. The page
      // waits for an arrow key, because a highlighted row on a touch screen looks like
      // a tap that got stuck.
      if (variant === "dialog" && results.length > 0) {
        setHighlightedIndex(0);
        scrollIntoViewAfterCommit(getOptionId(0));
      } else {
        setHighlightedIndex(-1);
      }
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

  const selectStock = (sid: string): void => {
    stockSearchCache.add(sid);
    onSelectStock(sid);
  };

  const hasResults = searchResults.length > 0;

  // The results stay on screen until the search for a new keyword finishes, but they
  // belong to the previous keyword, so they cannot be highlighted meanwhile.
  const areResultsCurrent = completedSearchKeyword === searchKeyword;
  const activeOptionId =
    highlightedIndex < 0 ? undefined : getOptionId(highlightedIndex);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (isImeComposing(event) || !hasResults || !areResultsCurrent) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = getNextHighlightedIndex(
        highlightedIndex,
        event.key === "ArrowDown" ? 1 : -1,
        searchResults.length,
      );
      setHighlightedIndex(nextIndex);
      scrollIntoViewAfterCommit(getOptionId(nextIndex));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectStock(searchResults[highlightedIndex].sid);
    }
  };

  const searchInput = (
    <SearchKeywordInput
      placeholder="輸入證券代號或名稱"
      keyword={searchKeyword}
      autoFocus
      size="l"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={hasResults ? listboxId : undefined}
      aria-expanded={hasResults}
      aria-activedescendant={activeOptionId}
      onKeyDown={handleSearchKeyDown}
      onChange={(keyword) => {
        searchKeywordRef.current = keyword;
        setSearchKeyword(keyword);
        setHighlightedIndex(-1);
        stockSearch.debouncedSearch(keyword);
      }}
    />
  );

  const results = !hasResults ? null : (
    <div className={styles.result} id={listboxId} role="listbox" aria-label="搜尋結果">
      {searchResults.map((stockInfo, index) => {
        return (
          <div
            id={getOptionId(index)}
            className={getRowClassName(
              stockInfo.fluct_price,
              index === highlightedIndex,
            )}
            key={stockInfo.sid}
            role="option"
            aria-selected={index === highlightedIndex}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            // Not mouseenter: it also fires when an arrow key scrolls a row under a
            // still pointer, which would take the highlight away.
            onMouseMove={() => {
              if (areResultsCurrent && highlightedIndex !== index) {
                setHighlightedIndex(index);
              }
            }}
            onClick={() => selectStock(stockInfo.sid)}
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
                {formatStockChange(
                  stockInfo.fluct_price,
                  stockInfo.close - stockInfo.fluct_price,
                )}
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
              <Icons.IconMagnifier sideLength="32" />
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

function getRowClassName(fluctPrice: number, isHighlighted: boolean): string {
  const priceClassName =
    fluctPrice > 0 ? styles.red : fluctPrice < 0 ? styles.green : styles.gray;
  return `${styles.row} ${priceClassName} ${isHighlighted ? styles.highlighted : ""}`;
}
