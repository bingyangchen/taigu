import { useCallback, useEffect, useRef, useState } from "react";

import Api from "../../utils/api";
import { isNotFound, useOnLostAccess } from "./access";

type AdminData<T> =
  | { status: "loading"; data: null }
  | { status: "loaded"; data: T }
  | { status: "failed"; data: null };

export type AdminDataState<T> = AdminData<T> & { reload: () => void };

/** With a null endpoint, nothing is fetched and the state is left as it is. */
export default function useAdminData<T>(endpoint: string | null): AdminDataState<T> {
  const [state, setState] = useState<AdminData<T>>({ status: "loading", data: null });
  const latestRequestId = useRef(0);
  const onLostAccess = useOnLostAccess();

  const load = useCallback(async (): Promise<void> => {
    if (endpoint === null) return;
    const requestId = ++latestRequestId.current;
    setState({ status: "loading", data: null });
    try {
      const response = (await Api.sendRequest(endpoint, "get", undefined, {
        redirectOnNotFound: false,
      })) as T | undefined;
      // No response means Api is already taking the user to another page.
      if (response === undefined || requestId !== latestRequestId.current) return;
      setState({ status: "loaded", data: response });
    } catch (error) {
      if (isNotFound(error)) onLostAccess();
      else if (requestId === latestRequestId.current) {
        setState({ status: "failed", data: null });
      }
    }
  }, [endpoint, onLostAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: () => void load() };
}
