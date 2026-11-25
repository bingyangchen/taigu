import React from "react";
import type { Location, NavigateFunction, Params } from "react-router-dom";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from "react-router-dom";

export const settingsPagePath = "settings";
export const adminPagePath = "admin";

export interface IRouter {
  router: {
    location: Location;
    navigationType: ReturnType<typeof useNavigationType>;
    navigate: NavigateFunction;
    params: Params;
    search_params: URLSearchParams;
    set_search_params: ReturnType<typeof useSearchParams>[1];
  };
}

export function navigateBack(
  { location, navigate }: Pick<IRouter["router"], "location" | "navigate">,
  fallbackPath: string,
): void {
  const index = window.history.state?.idx;
  // Replacing a deep link creates a key but keeps the router at its initial index.
  if (location.key === "default" || !Number.isInteger(index) || index <= 0) {
    navigate(fallbackPath, { replace: true });
    return;
  }
  navigate(-1);
}

export function withRouter<T extends IRouter>(Component: React.ComponentType<T>) {
  const WrappedComponent = (props: Omit<T, keyof IRouter>) => {
    const location = useLocation();
    const navigationType = useNavigationType();
    const navigate = useNavigate();
    const params = useParams();
    const [search_params, set_search_params] = useSearchParams();
    return (
      <Component
        {...(props as T)}
        router={{
          location,
          navigationType,
          navigate,
          params,
          search_params,
          set_search_params,
        }}
      />
    );
  };
  WrappedComponent.displayName = `withRouter(${Component.displayName ?? Component.name ?? "Component"})`;
  return WrappedComponent;
}
