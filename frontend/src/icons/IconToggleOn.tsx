import React from "react";

import { asIcon } from "./IconLayout";

interface Props {}
interface State {}

class IconToggleOn extends React.Component<Props, State> {
  public state: State;

  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render(): React.ReactNode {
    return (
      <path d="m16,4h-8C3.589,4,0,7.589,0,12s3.589,8,8,8h8c4.411,0,8-3.589,8-8s-3.589-8-8-8Zm0,14h-8c-3.309,0-6-2.691-6-6s2.691-6,6-6h8c3.309,0,6,2.691,6,6s-2.691,6-6,6Zm4-6c0,2.206-1.794,4-4,4s-4-1.794-4-4,1.794-4,4-4,4,1.794,4,4Z" />
    );
  }
}

export default asIcon(IconToggleOn);
