import React, { useContext } from "react";

import { ApiError } from "../../utils/api";

export const LostAccessContext = React.createContext<(() => void) | null>(null);

/**
 * Returns what to call when an admin data read answers 404, which means the user is
 * no longer a superuser, so the console shows the 404 page at the current URL
 * (ADMIN-R1).
 */
export function useOnLostAccess(): () => void {
  const onLostAccess = useContext(LostAccessContext);
  if (onLostAccess === null) {
    throw new Error("useOnLostAccess must be used inside LostAccessContext");
  }
  return onLostAccess;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
