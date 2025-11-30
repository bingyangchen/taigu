import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Location,
  NavigateFunction,
  Params,
  Route,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

// layer one
import Login from "./pages/Login/Login";
// layer two
import Details from "./pages/Main/Details/Details";
import Home from "./pages/Main/Home/Home";
import Main from "./pages/Main/Main";
import Market from "./pages/Main/Market/Market";
import Plans from "./pages/Main/Plans/Plans";
import Records from "./pages/Main/Records/Records";
import NotFound from "./pages/NotFound/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
// import DeleteAccount from "./pages/Settings/DeleteAccount/DeleteAccount";
import AccountBinding from "./pages/Settings/AccountBinding/AccountBinding";
import Overview from "./pages/Settings/Overview/Overview";
import Settings from "./pages/Settings/Settings";
import UserInfo from "./pages/Settings/UserInfo/UserInfo";
import TermsOfService from "./pages/TermsOfService/TermsOfService";
import Welcome from "./pages/Welcome/Welcome";
import Env from "./utils/env";

export const settingsPagePath = "settings";

const myRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route path={Env.frontendRootPath}>
      <Route path="welcome" element={<Welcome />} />
      <Route path="login" element={<Login />} />
      <Route path={settingsPagePath} element={<Settings />}>
        <Route path="" element={<Overview />}></Route>
        <Route path="user-info" element={<UserInfo />}></Route>
        <Route path="account-binding" element={<AccountBinding />}></Route>
        {/* <Route path="delete-account" element={<DeleteAccount />} /> */}
      </Route>
      <Route path="" element={<Main />}>
        <Route path="" element={<Home />}></Route>
        <Route path="records" element={<Records />}></Route>
        <Route path="market" element={<Market />}></Route>
        <Route path="market/:sid" element={<Details />} />
        <Route path="market/holding/:sid" element={<Details />} />
        <Route path="market/favorites/:sid" element={<Details />} />
        <Route path="plans" element={<Plans />}></Route>
        {/* <Route path="tools" element={<ExternalApps />} /> */}
      </Route>
      <Route path="privacy-policy" element={<PrivacyPolicy />}></Route>
      <Route path="terms-of-service" element={<TermsOfService />}></Route>
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);

export default myRouter;

export interface IRouter {
  router: {
    location: Location;
    navigate: NavigateFunction;
    params: Params;
    search_params: URLSearchParams;
    set_search_params: ReturnType<typeof useSearchParams>[1];
  };
}

export function withRouter<T extends IRouter>(Component: React.ComponentType<T>) {
  const WrappedComponent = (props: Omit<T, keyof IRouter>) => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const [search_params, set_search_params] = useSearchParams();
    return (
      <Component
        {...(props as T)}
        router={{ location, navigate, params, search_params, set_search_params }}
      />
    );
  };
  WrappedComponent.displayName = `withRouter(${Component.displayName ?? Component.name ?? "Component"})`;
  return WrappedComponent;
}
