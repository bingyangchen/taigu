import React, { MouseEvent, MouseEventHandler } from "react";

import { IRouter, withRouter } from "../../router";
import Env from "../../utils/env";
import Modal from "../Modal/Modal";
import StockSearchContent from "../StockSearchContent/StockSearchContent";

interface Props extends IRouter {
  hideModal: MouseEventHandler;
}

class StockSearchModal extends React.Component<Props> {
  public render(): React.ReactNode {
    return (
      <Modal
        discardButtonProps={{
          children: "",
          className: "transparent xs",
          onClick: this.props.hideModal,
        }}
        layout="fullScreen"
        transparent
        noFooter
        noX
      >
        <StockSearchContent variant="dialog" onSelectStock={this.handleSelectStock} />
      </Modal>
    );
  }

  private handleSelectStock = (sid: string, e: MouseEvent): void => {
    this.props.hideModal(e);
    setTimeout(() => {
      this.props.router.navigate(`${Env.frontendRootPath}market/${sid}`);
    }, 50);
  };
}

export default withRouter(StockSearchModal);
