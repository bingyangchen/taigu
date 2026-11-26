import { useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { getViewHistory, type ListView } from "./viewHistory";

/** Returns the list view saved for the history entry this page opens on. */
export function useSavedListView(): ListView | undefined {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [savedListView] = useState(
    () => getViewHistory().get(location, navigationType)?.list,
  );
  return savedListView;
}

/**
 * Saves `listView` for each history entry the page leaves while it stays mounted,
 * and for the last entry when it unmounts, so that going back restores the list.
 */
export function useListViewSaving(listView: ListView): void {
  const location = useLocation();
  const [viewHistory] = useState(getViewHistory);
  const lastCommitRef = useRef({ location, listView });

  useLayoutEffect(() => {
    const previous = lastCommitRef.current;
    lastCommitRef.current = { location, listView };
    if (previous.location.key !== location.key) {
      viewHistory.save(previous.location, { list: previous.listView });
    }
  });

  useLayoutEffect(
    () => () => {
      const last = lastCommitRef.current;
      viewHistory.save(last.location, { list: last.listView });
    },
    [viewHistory],
  );
}
