import React from "react";
import { connect } from "react-redux";

import { BeautifulBlock, BeautifulRow, HeaderForSettings } from "../../../components";
import { updateHeaderTitle } from "../../../redux/slices/SettingsPageSlice";
import type { AppDispatch } from "../../../redux/store";
import { IRouter, withRouter } from "../../../router";
import Api from "../../../utils/api";
import Util from "../../../utils/util";
import styles from "./DataControls.module.scss";

function mapStateToProps() {
  return {};
}

interface Props extends IRouter, ReturnType<typeof mapStateToProps> {
  dispatch: AppDispatch;
}

interface State {}

class DataControls extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public async componentDidMount(): Promise<void> {
    this.props.dispatch(updateHeaderTitle("資料控制"));
  }

  public render(): React.ReactNode {
    return (
      <>
        {!Util.isMobile && <HeaderForSettings />}
        <div className={styles.main}>
          <BeautifulBlock>
            <BeautifulRow onClick={this.handleExportAllTradeRecords}>
              <div className={styles.blue}>匯出所有交易紀錄</div>
            </BeautifulRow>
            {/* <BeautifulRow>
            <div className={styles.red}>刪除所有交易紀錄</div>
          </BeautifulRow> */}
          </BeautifulBlock>
          <BeautifulBlock>
            <BeautifulRow onClick={this.handleExportAllCashDividendRecords}>
              <div className={styles.blue}>匯出所有現金股利紀錄</div>
            </BeautifulRow>
            {/* <BeautifulRow>
            <div className={styles.red}>刪除所有現金股利紀錄</div>
          </BeautifulRow> */}
          </BeautifulBlock>
        </div>
      </>
    );
  }

  private downloadJsonFile = (data: unknown, filename: string): void => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  private handleExportAllTradeRecords = async (): Promise<void> => {
    const response = await Api.sendRequest("stock/trade-records", "get");
    this.downloadJsonFile(response, "trade-records.json");
  };

  private handleExportAllCashDividendRecords = async (): Promise<void> => {
    const response = await Api.sendRequest("stock/cash-dividends", "get");
    this.downloadJsonFile(response, "cash-dividend-records.json");
  };
}

export default connect(mapStateToProps)(withRouter(DataControls));
