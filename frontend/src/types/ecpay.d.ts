interface Window {
  ECPay?: {
    initialize: (
      environment: "Stage" | "Prod",
      displayMode: 1,
      callback: (errorMessage: string | null) => void,
    ) => void;
    addBindingCard: (
      token: string,
      language: "zh-TW" | "en-US",
      callback: (errorMessage: string | null) => void,
    ) => void;
    getBindCardPayToken: (
      callback: (
        result: { BindCardPayToken: string },
        errorMessage: string | null,
      ) => void,
    ) => void;
  };
}
