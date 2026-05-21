import React, { MouseEventHandler } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { StockSearchContent } from "../../../components";
import Env from "../../../utils/env";

export default function Search(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const closeSearch: MouseEventHandler = () => {
    if (location.key === "default") {
      navigate(`${Env.frontendRootPath}market`, { replace: true });
      return;
    }
    navigate(-1);
  };

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
