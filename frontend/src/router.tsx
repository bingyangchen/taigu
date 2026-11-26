import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  useLocation,
} from "react-router-dom";

import LoadingScreen from "./components/LoadingScreen/LoadingScreen";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Main/Dashboard/Dashboard";
import Details from "./pages/Main/Details/Details";
import EarningAnalysis from "./pages/Main/EarningAnalysis/EarningAnalysis";
import {
  CashDividendRecordCreateRoute,
  CashDividendRecordEditRoute,
  HandlingFeeDiscountCreateRoute,
  HandlingFeeDiscountEditRoute,
  TradePlanCreateRoute,
  TradePlanEditRoute,
  TradeRecordCreateRoute,
  TradeRecordEditRoute,
} from "./pages/Main/EditorRoutes/EditorRoutes";
import HandlingFee from "./pages/Main/HandlingFee/HandlingFee";
import Main from "./pages/Main/Main";
import Market from "./pages/Main/Market/Market";
import MarketIndexDetails from "./pages/Main/MarketIndexDetails/MarketIndexDetails";
import Plans from "./pages/Main/Plans/Plans";
import Records from "./pages/Main/Records/Records";
import Search from "./pages/Main/Search/Search";
import NotFound from "./pages/NotFound/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
import AccountBinding from "./pages/Settings/AccountBinding/AccountBinding";
import CurrentPlan from "./pages/Settings/CurrentPlan/CurrentPlan";
import DataControls from "./pages/Settings/DataControls/DataControls";
import IssueReport from "./pages/Settings/IssueReport/IssueReport";
import Overview from "./pages/Settings/Overview/Overview";
import Settings from "./pages/Settings/Settings";
import UserInfo from "./pages/Settings/UserInfo/UserInfo";
import TermsOfService from "./pages/TermsOfService/TermsOfService";
import Welcome from "./pages/Welcome/Welcome";
import Env from "./utils/env";
import { requireLogin } from "./utils/loginCheck";
import { adminPagePath, settingsPagePath } from "./utils/router";

const Admin = React.lazy(() => import("./pages/Admin/Admin"));

// UI state resets on load, so remove its history marker before the router reads it.
const { hash, pathname, search } = window.location;
if (["##", "#@", "#!"].includes(hash)) {
  window.history.replaceState(window.history.state, "", `${pathname}${search}`);
}

function SearchScopedRoute({ page: Page }: { page: React.ComponentType }) {
  const location = useLocation();
  const [view, setView] = React.useState({ location, key: location.key });
  if (view.location.key !== location.key) {
    const samePageOverlay =
      view.location.pathname === location.pathname &&
      view.location.search === location.search &&
      Boolean(view.location.hash || location.hash);
    setView({ location, key: samePageOverlay ? view.key : location.key });
  }
  return <Page key={view.key} />;
}

const myRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route path={Env.frontendRootPath}>
      <Route path="welcome" element={<Welcome />} />
      <Route path="login" element={<Login />} />
      <Route
        loader={requireLogin}
        // Pages inside keep the account fresh themselves, so moving between them
        // does not wait for another check.
        shouldRevalidate={() => false}
        HydrateFallback={LoadingScreen}
      >
        <Route path={settingsPagePath} element={<Settings />}>
          <Route path="" element={<Overview />}></Route>
          <Route path="user-info" element={<UserInfo />}></Route>
          <Route path="account-binding" element={<AccountBinding />}></Route>
          <Route path="current-plan" element={<CurrentPlan />}></Route>
          <Route path="data-controls" element={<DataControls />}></Route>
          <Route path="issue-report" element={<IssueReport />}></Route>
        </Route>
        <Route path="" element={<Main />}>
          <Route path="" element={<Dashboard />}></Route>
          <Route path="market-index" element={<MarketIndexDetails />} />
          <Route path="records" element={<SearchScopedRoute page={Records} />}></Route>
          <Route path="records/trade/new" element={<TradeRecordCreateRoute />}></Route>
          <Route
            path="records/trade/:recordId/edit"
            element={<TradeRecordEditRoute />}
          ></Route>
          <Route
            path="records/cash-dividend/new"
            element={<CashDividendRecordCreateRoute />}
          ></Route>
          <Route
            path="records/cash-dividend/:recordId/edit"
            element={<CashDividendRecordEditRoute />}
          ></Route>
          <Route path="market" element={<Market />}></Route>
          <Route path="search" element={<Search />}></Route>
          <Route path="market/:sid" element={<Details />} />
          <Route path="market/holding/:sid" element={<Details />} />
          <Route path="market/favorites/:sid" element={<Details />} />
          <Route path="plans" element={<SearchScopedRoute page={Plans} />}></Route>
          <Route path="plans/new" element={<TradePlanCreateRoute />}></Route>
          <Route path="plans/:planId/edit" element={<TradePlanEditRoute />}></Route>
          <Route path="earning-analysis" element={<EarningAnalysis />}></Route>
          <Route path="handling-fee" element={<HandlingFee />}></Route>
          <Route
            path="handling-fee/discounts/new"
            element={<HandlingFeeDiscountCreateRoute />}
          ></Route>
          <Route
            path="handling-fee/discounts/:discountId/edit"
            element={<HandlingFeeDiscountEditRoute />}
          ></Route>
        </Route>
        <Route
          path={`${adminPagePath}/*`}
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <Admin />
            </React.Suspense>
          }
        />
      </Route>
      <Route path="privacy-policy" element={<PrivacyPolicy />}></Route>
      <Route path="terms-of-service" element={<TermsOfService />}></Route>
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);

export default myRouter;
