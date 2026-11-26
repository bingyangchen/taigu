import React, {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import * as Icons from "../../icons";
import type {
  SelectedStock,
  StockInfo,
  StockSuggestions,
  SuggestedStock,
} from "../../types";
import Api from "../../utils/api";
import { getNextHighlightedIndex, isImeComposing } from "../../utils/keyboard";
import { formatNumber } from "../../utils/recordEditor";
import { useLatestRef } from "../../utils/useLatestRef";
import { useMergedState } from "../../utils/useMergedState";
import { useScrollIntoViewAfterCommit } from "../../utils/useScrollIntoViewAfterCommit";
import Util from "../../utils/util";
import styles from "./StockPicker.module.scss";

export const PENDING_KEYWORD_MESSAGE = "請從搜尋結果選擇一檔股票";

export interface StockPickerHandle {
  focus: () => void;
}

interface Props {
  ref?: React.Ref<StockPickerHandle>;
  selectedStock: SelectedStock | null;
  onChange: (_stock: SelectedStock | null) => void;

  /** Called only when the user picks a stock, after `onChange`. */
  onSelect?: (_stock: SelectedStock) => void;

  /** Reports the search text that is left without a stock chosen for it (MKT-R20). */
  onPendingKeywordChange?: (_keyword: string) => void;

  /** Listed below the empty search box (REC-R22). */
  suggestions?: StockSuggestions | null;
  sidHeldSharesMap?: { [sid: string]: number };
  errorMessage?: string | null;
}

interface PickerState {
  searchKeyword: string;
  searchResults: StockInfo[];
  completedSearchKeyword: string | null;
  highlightedIndex: number;
  isFocused: boolean;
  isOpen: boolean;
  isChanging: boolean;
  isListDismissed: boolean;
  isSearching: boolean;
  searchError: boolean;
  showSelectionPrompt: boolean;
}

const INITIAL_STATE: PickerState = {
  searchKeyword: "",
  searchResults: [],
  completedSearchKeyword: null,
  highlightedIndex: -1,
  isFocused: false,
  isOpen: false,
  isChanging: false,
  isListDismissed: false,
  isSearching: false,
  searchError: false,
  showSelectionPrompt: false,
};

export default function StockPicker(props: Props) {
  const {
    ref,
    selectedStock,
    suggestions,
    sidHeldSharesMap,
    errorMessage,
    onChange,
    onPendingKeywordChange,
  } = props;
  const [state, setState, runAfterCommitCallbacks] =
    useMergedState<PickerState>(INITIAL_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reportedPendingKeywordRef = useRef("");
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const messageId = `${baseId}-message`;

  // Timers, search responses and the callbacks that run after a commit read the
  // props and state of the latest render.
  const latestRenderRef = useLatestRef({ props, state });

  const focus = useCallback((): void => {
    const { props: latestProps, state: latestState } = latestRenderRef.current;
    if (Boolean(latestProps.selectedStock) && !latestState.isChanging) {
      changeButtonRef.current?.focus();
      return;
    }
    setState({ isFocused: true, isOpen: true }, () => inputRef.current?.focus());
  }, [latestRenderRef, setState]);

  useImperativeHandle(ref, () => ({ focus }), [focus]);

  const [debouncedSearch] = useState(() => {
    const search = async (searchKeyword: string): Promise<void> => {
      if (searchKeyword.trim() === "") {
        setState({
          searchResults: [],
          completedSearchKeyword: "",
          highlightedIndex: -1,
          isSearching: false,
          searchError: false,
        });
        return;
      }
      setState({ isSearching: true, searchError: false });
      try {
        const response = await Api.sendRequest(
          `market/search?keyword=${encodeURIComponent(searchKeyword)}`,
          "get",
        );
        if (latestRenderRef.current.state.searchKeyword !== searchKeyword) return;
        setState({
          searchResults: response.data,
          completedSearchKeyword: searchKeyword,
          highlightedIndex: response.data.length > 0 ? 0 : -1,
          isSearching: false,
        });
      } catch {
        if (latestRenderRef.current.state.searchKeyword !== searchKeyword) return;
        setState({
          searchResults: [],
          completedSearchKeyword: searchKeyword,
          highlightedIndex: -1,
          isSearching: false,
          searchError: true,
        });
      }
    };
    return Util.debounce(search, 300);
  });

  const selectedSid = selectedStock?.sid;
  const selectedName = selectedStock?.name;
  useEffect(() => {
    if (!selectedSid || selectedName) return;
    const loadSelectedStockName = async (): Promise<void> => {
      try {
        const companyNameMap = await Api.sendRequest(
          `market/company-names?sids=${encodeURIComponent(selectedSid)}`,
          "get",
        );
        const latestProps = latestRenderRef.current.props;
        if (
          latestProps.selectedStock?.sid === selectedSid &&
          companyNameMap[selectedSid]
        ) {
          latestProps.onChange({ sid: selectedSid, name: companyNameMap[selectedSid] });
        }
      } catch {
        return;
      }
    };
    void loadSelectedStockName();
  }, [latestRenderRef, selectedSid, selectedName]);

  useLayoutEffect(() => () => clearTimeout(blurTimerRef.current), []);

  const isShowingSelectedStock = Boolean(selectedStock) && !state.isChanging;
  const pendingKeyword =
    selectedStock && !state.isChanging ? "" : state.searchKeyword.trim();

  useLayoutEffect(() => {
    if (pendingKeyword !== reportedPendingKeywordRef.current) {
      reportedPendingKeywordRef.current = pendingKeyword;
      onPendingKeywordChange?.(pendingKeyword);
    }
  });

  // A class component runs its setState callbacks after componentDidUpdate, so this
  // effect comes after the ones above.
  useLayoutEffect(runAfterCommitCallbacks);

  const message =
    state.showSelectionPrompt && pendingKeyword
      ? PENDING_KEYWORD_MESSAGE
      : (errorMessage ?? null);
  const suggestedOptions = suggestions?.stocks ?? [];
  const resultOptions: SuggestedStock[] = state.searchResults.map((stock) => ({
    sid: stock.sid,
    name: stock.name,
    heldShares: sidHeldSharesMap?.[stock.sid] ?? null,
  }));
  const isKeywordEmpty = state.searchKeyword.trim() === "";
  const visibleOptions = isKeywordEmpty
    ? suggestedOptions
    : state.isSearching || state.searchError
      ? []
      : resultOptions;
  const isListVisible =
    state.isOpen &&
    !state.isListDismissed &&
    (!isKeywordEmpty || suggestedOptions.length > 0);
  const getOptionId = (index: number): string => `${listboxId}-option-${index}`;
  const activeOptionId =
    state.highlightedIndex < 0 ? undefined : getOptionId(state.highlightedIndex);
  const scrollIntoViewAfterCommit = useScrollIntoViewAfterCommit();

  const selectStock = (option: SuggestedStock): void => {
    const stock = { sid: option.sid, name: option.name };
    setState(
      {
        searchKeyword: "",
        searchResults: [],
        completedSearchKeyword: null,
        highlightedIndex: -1,
        isFocused: false,
        isOpen: false,
        isChanging: false,
        isListDismissed: false,
        isSearching: false,
        searchError: false,
        showSelectionPrompt: false,
      },
      () => latestRenderRef.current.props.onSelect?.(stock),
    );
    onChange(stock);
  };

  const handleChangeStock = (): void => {
    setState(
      {
        searchKeyword: "",
        searchResults: [],
        completedSearchKeyword: null,
        highlightedIndex: -1,
        isChanging: true,
        isListDismissed: false,
        searchError: false,
        showSelectionPrompt: false,
      },
      focus,
    );
  };

  const handleSearchKeywordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const searchKeyword = event.target.value;
    setState({
      searchKeyword,

      // The results on screen belong to the previous keyword until the new
      // search finishes, so they are hidden and cannot be picked meanwhile.
      isSearching: searchKeyword.trim() !== "",
      isOpen: true,
      isListDismissed: false,
      highlightedIndex: -1,
      searchError: false,
      showSelectionPrompt: false,
    });
    debouncedSearch(searchKeyword);
  };

  const handleFocusInput = (): void => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setState({ isFocused: true, isOpen: true, isListDismissed: false });
  };

  const handleBlurInput = (): void => {
    setState({ isFocused: false });
    blurTimerRef.current = setTimeout(() => {
      setState((previous) => {
        const hasKeyword = previous.searchKeyword.trim().length > 0;
        return {
          isOpen: false,
          highlightedIndex: -1,
          isChanging: previous.isChanging && hasKeyword,
          showSelectionPrompt: hasKeyword,
        };
      });
    }, 100);
  };

  const moveHighlight = (offset: 1 | -1): void => {
    const optionCount = visibleOptions.length;
    if (optionCount === 0) return;
    const nextIndex = getNextHighlightedIndex(
      state.highlightedIndex,
      offset,
      optionCount,
    );
    setState({ highlightedIndex: nextIndex, isListDismissed: false, isOpen: true });
    scrollIntoViewAfterCommit(getOptionId(nextIndex));
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (isImeComposing(event)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Enter") {
      // Enter only picks a stock; it never submits the editor (REC-R1, PLAN-R6).
      event.preventDefault();
      const highlighted = visibleOptions[state.highlightedIndex];
      if (highlighted && isListVisible) selectStock(highlighted);
    } else if (event.key === "Escape" && isListVisible) {
      setState({ isListDismissed: true, highlightedIndex: -1 });
    }
  };

  const renderOptions = (
    options: SuggestedStock[],
    title?: string,
  ): React.ReactNode => {
    const titleId = `${listboxId}-title`;
    return (
      <>
        {title && (
          <div className={styles.group_title} id={titleId}>
            {title}
          </div>
        )}
        <div
          className={styles.results}
          id={listboxId}
          role="listbox"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : "搜尋結果"}
        >
          {options.map((option, index) => {
            return (
              <button
                type="button"
                id={getOptionId(index)}
                key={option.sid}
                className={`${styles.result} ${
                  state.highlightedIndex === index ? styles.highlighted : ""
                }`}
                role="option"
                aria-selected={state.highlightedIndex === index}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                // Not mouseenter: it also fires when an arrow key scrolls an option
                // under a still pointer, which would take the highlight away.
                onMouseMove={() => {
                  if (state.highlightedIndex !== index) {
                    setState({ highlightedIndex: index });
                  }
                }}
                onClick={() => selectStock(option)}
              >
                <span className={styles.result_name}>{option.name}</span>
                <span className={styles.result_sid}>
                  {option.sid}
                  {option.heldShares !== null &&
                    `・持有 ${formatNumber(option.heldShares)} 股`}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const renderSearchPanel = (): React.ReactNode => {
    const keyword = state.completedSearchKeyword?.trim() ?? "";
    if (isKeywordEmpty) {
      return renderOptions(suggestedOptions, suggestions?.title);
    }
    if (state.isSearching) {
      return <div className={styles.feedback}>搜尋股票中...</div>;
    }
    if (state.searchError) {
      return (
        <div className={`${styles.feedback} ${styles.error}`}>
          目前無法搜尋股票，請稍後再試一次。
        </div>
      );
    }
    if (state.searchResults.length > 0) {
      return renderOptions(resultOptions);
    }
    if (keyword) {
      return (
        <div className={styles.feedback}>
          <strong>找不到符合的股票</strong>
          <span>請確認證券代號或名稱是否正確，或換個關鍵字再試一次。</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.main}>
      <fieldset
        className={`${styles.field} ${state.isFocused ? styles.focused : ""} ${
          message ? styles.invalid : ""
        }`}
      >
        <legend className={state.isFocused ? styles.focused : ""}>股票</legend>
        {isShowingSelectedStock && selectedStock ? (
          <button
            type="button"
            ref={changeButtonRef}
            className={styles.selected_stock}
            aria-label={`已選股票：${selectedStock.name ?? selectedStock.sid}，證券代號 ${selectedStock.sid}。更換股票`}
            onClick={handleChangeStock}
            onFocus={() => setState({ isFocused: true })}
            onBlur={() => setState({ isFocused: false })}
          >
            <span className={styles.selected_identity}>
              <span className={styles.selected_name}>
                {selectedStock.name ?? "讀取股票名稱中..."}
              </span>
              <span className={styles.selected_sid}>{selectedStock.sid}</span>
            </span>
            <span className={styles.change_action}>更換</span>
          </button>
        ) : (
          <input
            id={inputId}
            ref={inputRef}
            aria-autocomplete="list"
            aria-controls={isListVisible ? listboxId : undefined}
            aria-expanded={isListVisible}
            aria-label="股票"
            aria-activedescendant={activeOptionId}
            aria-describedby={message ? messageId : undefined}
            aria-invalid={message ? true : undefined}
            role="combobox"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="搜尋證券代號或名稱"
            value={state.searchKeyword}
            onChange={handleSearchKeywordChange}
            onFocus={handleFocusInput}
            onBlur={handleBlurInput}
            onKeyDown={handleInputKeyDown}
          />
        )}
      </fieldset>
      {message && (
        <div className={styles.selection_prompt} id={messageId}>
          <Icons.IconExclamation sideLength="14" />
          <span>{message}</span>
        </div>
      )}
      {isListVisible && (
        <div className={styles.search_panel}>{renderSearchPanel()}</div>
      )}
    </div>
  );
}
