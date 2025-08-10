import React from "react";

import { asIcon } from "./IconLayout";

interface Props {}
interface State {}

class IconStar extends React.Component<Props, State> {
  public state: State;

  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render(): React.ReactNode {
    return (
      <path d="M1.327,12.4,4.887,15,3.535,19.187A3.178,3.178,0,0,0,4.719,22.8a3.177,3.177,0,0,0,3.8-.019L12,20.219l3.482,2.559a3.227,3.227,0,0,0,4.983-3.591L19.113,15l3.56-2.6a3.227,3.227,0,0,0-1.9-5.832H16.4L15.073,2.432a3.227,3.227,0,0,0-6.146,0L7.6,6.568H3.231a3.227,3.227,0,0,0-1.9,5.832Z" />
    );
  }
}

export default asIcon(IconStar);
