import { MouseEvent, MouseEventHandler } from "react";
import { useNavigate } from "react-router-dom";

import Env from "../../utils/env";
import Modal from "../Modal/Modal";
import StockSearchContent from "../StockSearchContent/StockSearchContent";

interface Props {
  hideModal: MouseEventHandler;
}

export default function StockSearchModal({ hideModal }: Props) {
  const navigate = useNavigate();

  const handleSelectStock = (sid: string, e: MouseEvent): void => {
    hideModal(e);
    setTimeout(() => {
      navigate(`${Env.frontendRootPath}market/${sid}`);
    }, 50);
  };

  return (
    <Modal
      discardButtonProps={{ children: "", variant: "transparent", onClick: hideModal }}
      layout="fullScreen"
      transparent
      noFooter
      noX
    >
      <StockSearchContent variant="dialog" onSelectStock={handleSelectStock} />
    </Modal>
  );
}
