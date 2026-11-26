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
  defaultSid?: string;
}

/** The editor or search window that the add and search entries of the navigation open. */
export default function AddOrSearchModal({ modalName, hideModal, defaultSid }: Props) {
  switch (modalName) {
    case "createTradeRecord":
      return <TradeRecordEditor defaultSid={defaultSid} hideModal={hideModal} />;
    case "createCashDividendRecord":
      return <CashDividendRecordEditor defaultSid={defaultSid} hideModal={hideModal} />;
    case "createTradePlan":
      return <TradePlanEditor defaultSid={defaultSid} hideModal={hideModal} />;
    case "search":
      return <StockSearchModal hideModal={hideModal} />;
  }
}
