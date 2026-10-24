import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AutoResizeTextarea, FormPageShell, Modal } from "../../../components";
import { useAppDispatch } from "../../../redux/hooks";
import { pushToast } from "../../../redux/slices/ToastSlice";
import Api from "../../../utils/api";
import Env from "../../../utils/env";
import Util from "../../../utils/util";
import styles from "./IssueReport.module.scss";

const BODY_MAX_LENGTH = 5000;
const SETTINGS_PATH = `${Env.frontendRootPath}settings`;

interface IssueReportEditorProps {
  hideModal: React.MouseEventHandler;
  presentation?: "modal" | "page";
}

export function IssueReportEditor({
  hideModal,
  presentation = "modal",
}: IssueReportEditorProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const [body, setBody] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  const trimmedBody = body.trim();
  const isDirty = trimmedBody.length > 0;
  const canSubmit =
    !isWaiting && trimmedBody.length > 0 && trimmedBody.length <= BODY_MAX_LENGTH;

  const discardButtonProps = {
    children: "取消",
    className: "transparent l",
    onClick: hideModal,
  };
  const submitButtonProps = {
    children: "送出",
    className: "primary_fill l",
    disabled: !canSubmit,
    waiting: isWaiting,
    onClick: handleClickSubmit,
  };
  const form = (
    <div className={styles.form}>
      <AutoResizeTextarea
        value={body}
        onChange={(event) => setBody((event.target as HTMLTextAreaElement).value)}
        placeholder="請描述你遇到的問題或建議。"
        autoFocus
      />
    </div>
  );

  async function handleClickSubmit(event: React.MouseEvent): Promise<void> {
    if (!canSubmit) return;
    setIsWaiting(true);
    try {
      await Api.sendRequest(
        "issue-reports",
        "post",
        JSON.stringify({ body: trimmedBody, platform: Util.platform }),
      );
      dispatch(pushToast({ type: "success", text: "問題回報已送出，感謝你的回饋。" }));
      hideModal(event);
    } finally {
      setIsWaiting(false);
    }
  }

  if (presentation === "page") {
    return (
      <FormPageShell
        title="問題回報"
        discardButtonProps={discardButtonProps}
        isDirty={isDirty}
        submitButtonProps={submitButtonProps}
      >
        {form}
      </FormPageShell>
    );
  }

  return (
    <Modal
      title="問題回報"
      discardButtonProps={discardButtonProps}
      submitButtonProps={submitButtonProps}
      layout={Util.isMobile ? "fullScreen" : "compact"}
      noX
      silentBackground
    >
      {form}
    </Modal>
  );
}

export default function IssueReport(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <IssueReportEditor presentation="page" hideModal={() => navigate(SETTINGS_PATH)} />
  );
}
