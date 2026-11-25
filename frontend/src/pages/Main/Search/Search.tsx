import React, { MouseEventHandler } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { StockSearchContent } from "../../../components";
import Env from "../../../utils/env";
import { navigateBack } from "../../../utils/router";

export default function Search(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const closeSearch: MouseEventHandler = () =>
    navigateBack({ location, navigate }, `${Env.frontendRootPath}market`);

  return (
    <StockSearchContent
      variant="page"
      onClose={closeSearch}
      onSelectStock={(sid) =>
        navigate(`${Env.frontendRootPath}market/${sid}`, { replace: true })
      }
    />
  );
}
