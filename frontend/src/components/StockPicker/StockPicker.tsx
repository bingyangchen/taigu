import React, { ChangeEvent, KeyboardEvent } from "react";

import * as Icons from "../../icons";
import type {
  SelectedStock,
  StockInfo,
  StockSuggestions,
  SuggestedStock,
} from "../../types";
import Api from "../../utils/api";
import { formatNumber } from "../../utils/recordEditor";
import Util from "../../utils/util";
import styles from "./StockPicker.module.scss";

export const PENDING_KEYWORD_MESSAGE = "請從搜尋結果選擇一檔股票";

interface Props {
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

interface State {
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

let stockPickerId = 0;

export default class StockPicker extends React.Component<Props, State> {
  public state: State;
  private inputRef: React.RefObject<HTMLInputElement | null>;
  private changeButtonRef: React.RefObject<HTMLButtonElement | null>;
  private readonly inputId: string;
  private readonly listboxId: string;
  private readonly messageId: string;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;
  private reportedPendingKeyword: string = "";

  public constructor(props: Props) {
    super(props);
    this.state = {
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
    this.inputRef = React.createRef();
    this.changeButtonRef = React.createRef();
    stockPickerId += 1;
    this.inputId = `stock-picker-input-${stockPickerId}`;
    this.listboxId = `stock-picker-listbox-${stockPickerId}`;
    this.messageId = `stock-picker-message-${stockPickerId}`;
  }

  public componentDidMount(): void {
    this.loadSelectedStockName();
  }

  public componentDidUpdate(previousProps: Readonly<Props>): void {
    if (
      this.props.selectedStock?.sid !== previousProps.selectedStock?.sid ||
      this.props.selectedStock?.name !== previousProps.selectedStock?.name
    ) {
      this.loadSelectedStockName();
    }
    if (this.pendingKeyword !== this.reportedPendingKeyword) {
      this.reportedPendingKeyword = this.pendingKeyword;
      this.props.onPendingKeywordChange?.(this.pendingKeyword);
    }
  }

  public componentWillUnmount(): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
  }

  public focus(): void {
    if (this.isShowingSelectedStock) {
      this.changeButtonRef.current?.focus();
      return;
    }
    this.setState({ isFocused: true, isOpen: true }, () => {
      this.inputRef.current?.focus();
    });
  }

  public render(): React.ReactNode {
    const message = this.message;
    return (
      <div className={styles.main}>
        <fieldset
          className={`${styles.field} ${this.state.isFocused ? styles.focused : ""} ${
            message ? styles.invalid : ""
          }`}
        >
          <legend className={this.state.isFocused ? styles.focused : ""}>股票</legend>
          {this.isShowingSelectedStock
            ? this.renderSelectedStock()
            : this.renderSearchInput()}
        </fieldset>
        {message && (
          <div className={styles.selection_prompt} id={this.messageId}>
            <Icons.IconExclamation sideLength="14" />
            <span>{message}</span>
          </div>
        )}
        {this.isListVisible && (
          <div className={styles.search_panel}>{this.renderSearchPanel()}</div>
        )}
      </div>
    );
  }

  private renderSelectedStock(): React.ReactNode {
    if (!this.props.selectedStock) return null;
    const { sid, name } = this.props.selectedStock;
    return (
      <button
        type="button"
        ref={this.changeButtonRef}
        className={styles.selected_stock}
        aria-label={`已選股票：${name ?? sid}，證券代號 ${sid}。更換股票`}
        onClick={this.handleChangeStock}
        onFocus={() => this.setState({ isFocused: true })}
        onBlur={() => this.setState({ isFocused: false })}
      >
        <span className={styles.selected_identity}>
          <span className={styles.selected_name}>{name ?? "讀取股票名稱中..."}</span>
          <span className={styles.selected_sid}>{sid}</span>
        </span>
        <span className={styles.change_action}>更換</span>
      </button>
    );
  }

  private renderSearchInput(): React.ReactNode {
    return (
      <input
        id={this.inputId}
        ref={this.inputRef}
        aria-autocomplete="list"
        aria-controls={this.isListVisible ? this.listboxId : undefined}
        aria-expanded={this.isListVisible}
        aria-label="股票"
        aria-activedescendant={this.activeOptionId}
        aria-describedby={this.message ? this.messageId : undefined}
        aria-invalid={this.message ? true : undefined}
        role="combobox"
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="搜尋證券代號或名稱"
        value={this.state.searchKeyword}
        onChange={this.handleSearchKeywordChange}
        onFocus={this.handleFocusInput}
        onBlur={this.handleBlurInput}
        onKeyDown={this.handleInputKeyDown}
      />
    );
  }

  private renderSearchPanel(): React.ReactNode {
    const keyword = this.state.completedSearchKeyword?.trim() ?? "";
    if (this.state.searchKeyword.trim() === "") {
      return this.renderOptions(this.suggestedOptions, this.props.suggestions?.title);
    }
    if (this.state.isSearching) {
      return <div className={styles.feedback}>搜尋股票中...</div>;
    }
    if (this.state.searchError) {
      return (
        <div className={`${styles.feedback} ${styles.error}`}>
          目前無法搜尋股票，請稍後再試一次。
        </div>
      );
    }
    if (this.state.searchResults.length > 0) {
      return this.renderOptions(this.resultOptions);
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
  }

  private renderOptions(options: SuggestedStock[], title?: string): React.ReactNode {
    const titleId = `${this.listboxId}-title`;
    return (
      <>
        {title && (
          <div className={styles.group_title} id={titleId}>
            {title}
          </div>
        )}
        <div
          className={styles.results}
          id={this.listboxId}
          role="listbox"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : "搜尋結果"}
        >
          {options.map((option, index) => {
            return (
              <button
                type="button"
                id={this.getOptionId(index)}
                key={option.sid}
                className={`${styles.result} ${
                  this.state.highlightedIndex === index ? styles.highlighted : ""
                }`}
                role="option"
                aria-selected={this.state.highlightedIndex === index}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => this.setState({ highlightedIndex: index })}
                onClick={() => this.selectStock(option)}
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
  }

  private get message(): string | null {
    if (this.state.showSelectionPrompt && this.pendingKeyword) {
      return PENDING_KEYWORD_MESSAGE;
    }
    return this.props.errorMessage ?? null;
  }

  private get pendingKeyword(): string {
    if (this.props.selectedStock && !this.state.isChanging) return "";
    return this.state.searchKeyword.trim();
  }

  private get isShowingSelectedStock(): boolean {
    return Boolean(this.props.selectedStock) && !this.state.isChanging;
  }

  private get suggestedOptions(): SuggestedStock[] {
    return this.props.suggestions?.stocks ?? [];
  }

  private get resultOptions(): SuggestedStock[] {
    return this.state.searchResults.map((stock) => ({
      sid: stock.sid,
      name: stock.name,
      heldShares: this.props.sidHeldSharesMap?.[stock.sid] ?? null,
    }));
  }

  private get visibleOptions(): SuggestedStock[] {
    if (this.state.searchKeyword.trim() === "") return this.suggestedOptions;
    if (this.state.isSearching || this.state.searchError) return [];
    return this.resultOptions;
  }

  private get isListVisible(): boolean {
    if (!this.state.isOpen || this.state.isListDismissed) return false;
    if (this.state.searchKeyword.trim() === "") return this.suggestedOptions.length > 0;
    return true;
  }

  private get activeOptionId(): string | undefined {
    if (this.state.highlightedIndex < 0) return undefined;
    return this.getOptionId(this.state.highlightedIndex);
  }

  private getOptionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  private loadSelectedStockName = async (): Promise<void> => {
    const selectedStock = this.props.selectedStock;
    if (!selectedStock || selectedStock.name) return;
    try {
      const companyNameMap = await Api.sendRequest(
        `market/company-names?sids=${encodeURIComponent(selectedStock.sid)}`,
        "get",
      );
      if (
        this.props.selectedStock?.sid === selectedStock.sid &&
        companyNameMap[selectedStock.sid]
      ) {
        this.props.onChange({
          sid: selectedStock.sid,
          name: companyNameMap[selectedStock.sid],
        });
      }
    } catch {
      return;
    }
  };

  private search = async (searchKeyword: string): Promise<void> => {
    if (searchKeyword.trim() === "") {
      this.setState({
        searchResults: [],
        completedSearchKeyword: "",
        highlightedIndex: -1,
        isSearching: false,
        searchError: false,
      });
      return;
    }
    this.setState({ isSearching: true, searchError: false });
    try {
      const response = await Api.sendRequest(
        `market/search?keyword=${encodeURIComponent(searchKeyword)}`,
        "get",
      );
      if (this.state.searchKeyword !== searchKeyword) return;
      this.setState({
        searchResults: response.data,
        completedSearchKeyword: searchKeyword,
        highlightedIndex: response.data.length > 0 ? 0 : -1,
        isSearching: false,
      });
    } catch {
      if (this.state.searchKeyword !== searchKeyword) return;
      this.setState({
        searchResults: [],
        completedSearchKeyword: searchKeyword,
        highlightedIndex: -1,
        isSearching: false,
        searchError: true,
      });
    }
  };

  private debouncedSearch = Util.debounce(this.search, 300);

  private handleChangeStock = (): void => {
    this.setState(
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
      () => this.focus(),
    );
  };

  private handleSearchKeywordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const searchKeyword = event.target.value;
    this.setState({
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
    this.debouncedSearch(searchKeyword);
  };

  private handleFocusInput = (): void => {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.setState({ isFocused: true, isOpen: true, isListDismissed: false });
  };

  private handleBlurInput = (): void => {
    this.setState({ isFocused: false });
    this.blurTimer = setTimeout(() => {
      this.setState((state) => {
        const hasKeyword = state.searchKeyword.trim().length > 0;
        return {
          isOpen: false,
          highlightedIndex: -1,
          isChanging: state.isChanging && hasKeyword,
          showSelectionPrompt: hasKeyword,
        };
      });
    }, 100);
  };

  private handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.moveHighlight(-1);
    } else if (event.key === "Enter") {
      // Enter only picks a stock; it never submits the editor (REC-R1, PLAN-R6).
      event.preventDefault();
      const highlighted = this.visibleOptions[this.state.highlightedIndex];
      if (highlighted && this.isListVisible) this.selectStock(highlighted);
    } else if (event.key === "Escape" && this.isListVisible) {
      this.setState({ isListDismissed: true, highlightedIndex: -1 });
    }
  };

  private moveHighlight(offset: number): void {
    const optionCount = this.visibleOptions.length;
    if (optionCount === 0) return;
    this.setState((state) => {
      const currentIndex =
        state.highlightedIndex < 0 && offset < 0 ? 0 : state.highlightedIndex;
      const nextIndex = (currentIndex + offset + optionCount) % optionCount;
      return { highlightedIndex: nextIndex, isListDismissed: false, isOpen: true };
    });
  }

  private selectStock(option: SuggestedStock): void {
    const stock = { sid: option.sid, name: option.name };
    this.setState(
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
      () => this.props.onSelect?.(stock),
    );
    this.props.onChange(stock);
  }
}
