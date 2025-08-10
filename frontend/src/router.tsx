import React from "react";
import {
  Location,
  NavigateFunction,
  Params,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import Env from "./utils/env";

// layer one
import Login from "./pages/Login/Login";
import Main from "./pages/Main/Main";
import NotFound from "./pages/NotFound/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
import Settings from "./pages/Settings/Settings";
import TermsOfService from "./pages/TermsOfService/TermsOfService";
import Welcome from "./pages/Welcome/Welcome";

// layer two
import Details from "./pages/Main/Details/Details";
import Home from "./pages/Main/Home/Home";
import Market from "./pages/Main/Market/Market";
import Plans from "./pages/Main/Plans/Plans";
import Records from "./pages/Main/Records/Records";
// import DeleteAccount from "./pages/Settings/DeleteAccount/DeleteAccount";
import AccountBinding from "./pages/Settings/AccountBinding/AccountBinding";
import Overview from "./pages/Settings/Overview/Overview";
import UserInfo from "./pages/Settings/UserInfo/UserInfo";

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
  return (props: Omit<T, keyof IRouter>) => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const [search_params, set_search_params] = useSearchParams();
    return (
      <Component
        {...(props as T)}
        router={{
          location,
          navigate,
          params,
          search_params,
          set_search_params,
        }}
      />
    );
  };
}
