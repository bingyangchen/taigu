import {
  CashDividendRecordEditor,
  StockSearchModal,
  TradePlanEditor,
  TradeRecordEditor,
} from "../../components";

export type AddOrSearchModalName =
  | "createTradeRecord"
  | "createCashDividendRecord"
  | "createTradePlan"
  | "search";

interface Props {
  modalName: AddOrSearchModalName;
  hideModal: () => void;
}

/** The editor or search window that the sidebar's add and search entries open. */
export default function AddOrSearchModal({ modalName, hideModal }: Props) {
  switch (modalName) {
    case "createTradeRecord":
      return <TradeRecordEditor hideModal={hideModal} />;
    case "createCashDividendRecord":
      return <CashDividendRecordEditor hideModal={hideModal} />;
    case "createTradePlan":
      return <TradePlanEditor hideModal={hideModal} />;
    case "search":
      return <StockSearchModal hideModal={hideModal} />;
  }
}
