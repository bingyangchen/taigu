import React from "react";

import { asIcon } from "./IconLayout";

interface Props {}
interface State {}

class IconCheck extends React.Component<Props, State> {
  public state: State;

  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render(): React.ReactNode {
    return <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />;
  }
}

export default asIcon(IconCheck);
