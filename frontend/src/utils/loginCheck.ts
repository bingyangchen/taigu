import { type LoaderFunctionArgs, replace } from "react-router-dom";

import { fetchAccountInfo } from "../redux/slices/AccountSlice";
import { store } from "../redux/store";
import Env from "./env";
import { rememberReturnUrl } from "./returnUrl";

/**
 * The loader of the layout route that holds every page needing login. The router
 * draws none of those pages until it ends, so a logged-out user never sees one
 * before the welcome page (ACCT-R3).
 */
export async function requireLogin({
  request,
}: LoaderFunctionArgs): Promise<Response | null> {
  let account;
  try {
    account = await store
      .dispatch(fetchAccountInfo({ redirectOnUnauthorized: false }))
      .unwrap();
  } catch {
    // A failed connection does not confirm that the login ended (ACCT-R5), so the
    // page opens and reads the account itself.
    return null;
  }
  if (account) return null;
  const { pathname, search } = new URL(request.url);
  rememberReturnUrl(pathname + search);

  // Replacing the entry keeps the browser's back button from reopening the page,
  // which would send the user to the welcome page again.
  return replace(`${Env.frontendRootPath}welcome`);
}
