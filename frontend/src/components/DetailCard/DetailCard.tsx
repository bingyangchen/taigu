import styles from "./DetailCard.module.scss";

import React, { MouseEventHandler } from "react";
import { connect } from "react-redux";

import { calculateMarketValue } from "../../redux/slices/StockInfoSlice";
import type { RootState } from "../../redux/store";
import DollarSign from "../DollarSign/DollarSign";

function mapStateToProps(rootState: RootState) {
    const { sidStockInfoMap } = rootState.stockInfo;
    const {
        sidHandlingFeeMap,
        sidGainMap,
        sidCashInvestedMap,
        stockWarehouse,
    } = rootState.tradeRecord;
    const { sidTotalCashDividendMap } = rootState.cashDividend;
    return {
        sidStockInfoMap,
        sidCashInvestedMap,
        sidHandlingFeeMap,
        sidGainMap,
        sidTotalCashDividendMap,
        stockWarehouse,
    };
}

interface Props extends ReturnType<typeof mapStateToProps> {
    sid: string;
    includeWarehouseInfo?: boolean;
    onClick?: MouseEventHandler;
}

interface State {
    marketValue: number;
}

class DetailCard extends React.Component<Props, State> {
    public state: State;
    public constructor(props: Props) {
        super(props);
        this.state = {
            marketValue: props.includeWarehouseInfo
                ? calculateMarketValue(
                      props.sidStockInfoMap[props.sid],
                      props.stockWarehouse[props.sid] || []
                  )
                : 0,
        };
    }
    public componentDidMount(): void {}
    public componentDidUpdate(
        prevProps: Readonly<Props>,
        prevState: Readonly<State>,
        snapshot?: any
    ): void {
        if (
            this.props.includeWarehouseInfo &&
            (prevProps.stockWarehouse !== this.props.stockWarehouse ||
                prevProps.sidStockInfoMap !== this.props.sidStockInfoMap)
        ) {
            this.setState((state, props) => {
                return {
                    marketValue: calculateMarketValue(
                        props.sidStockInfoMap[props.sid],
                        props.stockWarehouse[props.sid] || []
                    ),
                };
            });
        }
    }
    public render(): React.ReactNode {
        return (
            this.props.sid in this.props.sidStockInfoMap && (
                <div
                    className={this.getMainClassName(
                        this.props.sidStockInfoMap[this.props.sid].fluct_price
                    )}
                    onClick={this.props.onClick}
                >
                    <div className={styles.upper}>
                        <div className={styles.company}>
                            <div className={styles.name}>
                                {
                                    this.props.sidStockInfoMap[this.props.sid]
                                        .name
                                }
                            </div>
                            <div className={styles.sid}>{this.props.sid}</div>
                        </div>
                        <div className={styles.price}>
                            <div className={styles.price}>
                                <DollarSign />
                                {
                                    this.props.sidStockInfoMap[this.props.sid]
                                        .close
                                }
                            </div>
                            <div className={styles.price_fluct}>
                                {this.fluctPriceString}
                            </div>
                        </div>
                    </div>
                    {this.props.includeWarehouseInfo &&
                        this.props.sid in this.props.sidCashInvestedMap &&
                        this.props.sid in this.props.stockWarehouse && (
                            <div className={styles.lower}>
                                <div className={styles.inventory}>
                                    庫存{" "}
                                    {
                                        this.props.stockWarehouse[
                                            this.props.sid
                                        ].length
                                    }{" "}
                                    股
                                </div>
                                <div className={styles.average_cost}>
                                    {`平均成本 $${(
                                        this.props.sidCashInvestedMap[
                                            this.props.sid
                                        ] /
                                        this.props.stockWarehouse[
                                            this.props.sid
                                        ].length
                                    ).toFixed(2)}`}
                                </div>
                                <div className={styles.rate_of_return}>
                                    報酬率 {this.rateOfReturn.toFixed(2)}%
                                </div>
                            </div>
                        )}
                </div>
            )
        );
    }
    private getMainClassName(fluct_price: number): string {
        return `${styles.main} ${
            fluct_price > 0
                ? styles.red
                : fluct_price < 0
                ? styles.green
                : styles.gray
        } ${!this.props.includeWarehouseInfo ? styles.tall : ""}`;
    }
    private get fluctPriceString(): string {
        const fluct_price =
            this.props.sidStockInfoMap[this.props.sid].fluct_price || 0;
        return `${fluct_price > 0 ? "▲" : fluct_price < 0 ? "▼" : "-"}${
            fluct_price !== 0 ? Math.abs(fluct_price) : ""
        }${
            fluct_price !== 0
                ? ` (${(
                      Math.abs(
                          fluct_price /
                              (this.props.sidStockInfoMap[this.props.sid]
                                  .close -
                                  fluct_price)
                      ) * 100
                  ).toFixed(2)}%)`
                : ""
        }`;
    }
    private get rateOfReturn(): number {
        return (
            ((this.state.marketValue -
                this.props.sidCashInvestedMap[this.props.sid] +
                this.props.sidGainMap[this.props.sid] +
                (this.props.sidTotalCashDividendMap[this.props.sid] || 0) -
                this.props.sidHandlingFeeMap[this.props.sid]) /
                this.props.sidCashInvestedMap[this.props.sid]) *
            100
        );
    }
}

export default connect(mapStateToProps)(DetailCard);
