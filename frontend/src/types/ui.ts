import type React from "react";

export type Subpage = {
  icon: React.ReactElement;
  icon_bold?: React.ReactElement;
  name: string;
  path: string;
};

export type ToastMessage = { type: "success" | "error"; text: string };

export type SelectedStock = { sid: string; name?: string };
