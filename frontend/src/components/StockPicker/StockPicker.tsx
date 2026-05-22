import React, { ChangeEvent, KeyboardEvent, MouseEvent } from "react";

import type { SelectedStock, StockInfo } from "../../types";
import Api from "../../utils/api";
import Util from "../../utils/util";
import Modal from "../Modal/Modal";
import styles from "./StockPicker.module.scss";

interface Props {
  selectedStock: SelectedStock | null;
  autoFocus?: boolean;
  onChange: (_stock: SelectedStock | null) => void;
}

interface State {
  searchKeyword: string;
  searchResults: StockInfo[];
  completedSearchKeyword: string | null;
  highlightedIndex: number;
  isFocused: boolean;
  isOpen: boolean;
  isSearching: boolean;
  searchError: boolean;
  showSelectionPrompt: boolean;
}

let stockPickerId = 0;

export default class StockPicker extends React.Component<Props, State> {
  public state: State;
  private inputRef: React.RefObject<HTMLInputElement>;
  private readonly inputId: string;
  private readonly listboxId: string;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(props: Props) {
    super(props);
    this.state = {
      searchKeyword: "",
      searchResults: [],
      completedSearchKeyword: null,
      highlightedIndex: -1,
      isFocused: false,
      isOpen: false,
      isSearching: false,
      searchError: false,
      showSelectionPrompt: false,
    };
    this.inputRef = React.createRef();
    stockPickerId += 1;
    this.inputId = `stock-picker-input-${stockPickerId}`;
    this.listboxId = `stock-picker-listbox-${stockPickerId}`;
  }

  public componentDidMount(): void {
    this.loadSelectedStockName();
    if (this.props.autoFocus && !this.props.selectedStock) this.focusInput();
  }

  public componentDidUpdate(previousProps: Readonly<Props>): void {
    if (
      this.props.selectedStock?.sid !== previousProps.selectedStock?.sid ||
      this.props.selectedStock?.name !== previousProps.selectedStock?.name
    ) {
      this.loadSelectedStockName();
    }
  }

  public componentWillUnmount(): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
  }

  public render(): React.ReactNode {
    if (Util.isMobile) return this.renderMobilePicker();

    return (
      <div className={styles.main}>
        {this.renderStockField()}
        {this.state.isOpen && this.renderSearchPanel()}
        {this.renderSelectionPrompt()}
      </div>
    );
  }

  private renderMobilePicker(): React.ReactNode {
    return (
      <div className={styles.main}>
        <fieldset
          className={`${styles.field} ${this.state.isFocused ? styles.focused : ""}`}
        >
          <legend className={this.state.isFocused ? styles.focused : ""}>股票</legend>
          {this.props.selectedStock
            ? this.renderSelectedStock()
            : this.renderMobileTrigger()}
        </fieldset>
        {this.renderSelectionPrompt()}
        {this.state.isOpen && (
          <Modal
            title="選擇股票"
            description="搜尋證券代號或名稱後選擇股票。"
            discardButtonProps={{
              children: "返回",
              className: "transparent l",
              onClick: this.handleCloseMobileSearch,
            }}
            layout="fullScreen"
            noFooter
            visualLayer="nested"
            manageHistory={false}
          >
            <div className={styles.mobile_search}>
              {this.renderMobileSearchInput()}
              {this.renderSearchPanel()}
            </div>
          </Modal>
        )}
      </div>
    );
  }

  private renderStockField(): React.ReactNode {
    return (
      <fieldset
        className={`${styles.field} ${this.state.isFocused ? styles.focused : ""}`}
      >
        <legend className={this.state.isFocused ? styles.focused : ""}>股票</legend>
        {this.props.selectedStock && !this.state.isOpen
          ? this.renderSelectedStock()
          : this.renderSearchInput()}
      </fieldset>
    );
  }

  private renderMobileTrigger(): React.ReactNode {
    return (
      <button
        type="button"
        className={styles.empty_stock}
        aria-label="選擇股票"
        onClick={this.handleOpenMobileSearch}
        onFocus={() => this.setState({ isFocused: true })}
        onBlur={() => this.setState({ isFocused: false })}
      >
        選擇股票
      </button>
    );
  }

  private renderSelectedStock(): React.ReactNode {
    if (!this.props.selectedStock) return null;
    const { sid, name } = this.props.selectedStock;
    return (
      <button
        type="button"
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
        aria-controls={this.listboxId}
        aria-expanded={this.state.isOpen}
        aria-label="股票"
        aria-activedescendant={this.activeOptionId}
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

  private renderMobileSearchInput(): React.ReactNode {
    return (
      <label className={styles.mobile_search_input}>
        <span className={styles.mobile_search_label}>股票</span>
        {this.renderSearchInput()}
      </label>
    );
  }

  private renderSearchPanel(): React.ReactNode {
    const keyword = this.state.completedSearchKeyword?.trim() ?? "";
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
      return (
        <div className={styles.results} id={this.listboxId} role="listbox">
          {this.state.searchResults.map((stock, index) => {
            return (
              <button
                type="button"
                id={this.getOptionId(index)}
                key={stock.sid}
                className={`${styles.result} ${
                  this.state.highlightedIndex === index ? styles.highlighted : ""
                }`}
                role="option"
                aria-selected={this.state.highlightedIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => this.setState({ highlightedIndex: index })}
                onClick={() => this.selectStock(stock)}
              >
                <span className={styles.result_name}>{stock.name}</span>
                <span className={styles.result_sid}>{stock.sid}</span>
              </button>
            );
          })}
        </div>
      );
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

  private renderSelectionPrompt(): React.ReactNode {
    if (!this.state.showSelectionPrompt || this.props.selectedStock) return null;
    return <div className={styles.selection_prompt}>請從搜尋結果選擇一檔股票</div>;
  }

  private get activeOptionId(): string | undefined {
    if (this.state.highlightedIndex < 0) return undefined;
    return this.getOptionId(this.state.highlightedIndex);
  }

  private getOptionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  private focusInput(): void {
    this.setState({ isFocused: true, isOpen: true }, () => {
      this.inputRef.current?.focus();
    });
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
    } catch (error) {
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
    } catch (error) {
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
    this.props.onChange(null);
    this.setState(
      {
        searchKeyword: "",
        searchResults: [],
        completedSearchKeyword: null,
        highlightedIndex: -1,
        isOpen: true,
        searchError: false,
        showSelectionPrompt: false,
      },
      () => this.focusInput(),
    );
  };

  private handleSearchKeywordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const searchKeyword = event.target.value;
    this.setState({
      searchKeyword,
      isOpen: true,
      highlightedIndex: -1,
      searchError: false,
      showSelectionPrompt: false,
    });
    this.debouncedSearch(searchKeyword);
  };

  private handleFocusInput = (): void => {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.setState({ isFocused: true, isOpen: true });
  };

  private handleBlurInput = (): void => {
    this.setState({ isFocused: false });
    this.blurTimer = setTimeout(() => {
      this.setState((state) => ({
        isOpen: false,
        showSelectionPrompt: state.searchKeyword.trim().length > 0,
      }));
    }, 100);
  };

  private handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.moveHighlight(-1);
    } else if (event.key === "Enter" && this.state.highlightedIndex >= 0) {
      event.preventDefault();
      this.selectStock(this.state.searchResults[this.state.highlightedIndex]);
    } else if (event.key === "Escape") {
      this.setState({ isOpen: false });
      this.inputRef.current?.blur();
    }
  };

  private moveHighlight(offset: number): void {
    if (this.state.searchResults.length === 0) return;
    this.setState((state) => {
      const nextIndex =
        (state.highlightedIndex + offset + state.searchResults.length) %
        state.searchResults.length;
      return { highlightedIndex: nextIndex };
    });
  }

  private selectStock(stock: StockInfo): void {
    this.props.onChange({ sid: stock.sid, name: stock.name });
    this.setState({
      searchKeyword: "",
      searchResults: [],
      completedSearchKeyword: null,
      highlightedIndex: -1,
      isFocused: false,
      isOpen: false,
      isSearching: false,
      searchError: false,
      showSelectionPrompt: false,
    });
  }

  private handleOpenMobileSearch = (): void => {
    this.setState(
      {
        searchKeyword: "",
        searchResults: [],
        completedSearchKeyword: null,
        highlightedIndex: -1,
        isFocused: false,
        isOpen: true,
        isSearching: false,
        searchError: false,
        showSelectionPrompt: false,
      },
      () => this.focusInput(),
    );
  };

  private handleCloseMobileSearch = (_event: MouseEvent): void => {
    this.setState((state) => ({
      isFocused: false,
      isOpen: false,
      showSelectionPrompt: state.searchKeyword.trim().length > 0,
    }));
  };
}
