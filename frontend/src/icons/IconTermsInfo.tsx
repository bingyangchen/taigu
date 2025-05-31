import React from "react";

import { asIcon } from "./IconLayout";

interface Props {}
interface State {}

class IconTermsInfo extends React.Component<Props, State> {
  public state: State;

  public constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render(): React.ReactNode {
    return (
      <path d="M10,23c0,.552-.448,1-1,1H5c-2.757,0-5-2.243-5-5V5C0,2.243,2.243,0,5,0H13c2.757,0,5,2.243,5,5v2c0,.552-.448,1-1,1s-1-.448-1-1v-2c0-1.654-1.346-3-3-3H5c-1.654,0-3,1.346-3,3v14c0,1.654,1.346,3,3,3h4c.552,0,1,.448,1,1ZM14,6c0-.552-.448-1-1-1H5c-.552,0-1,.448-1,1s.448,1,1,1H13c.552,0,1-.448,1-1ZM5,15c-.552,0-1,.448-1,1s.448,1,1,1h2c.552,0,1-.448,1-1s-.448-1-1-1h-2Zm19,2c0,3.86-3.14,7-7,7s-7-3.14-7-7,3.14-7,7-7,7,3.14,7,7Zm-2,0c0-2.757-2.243-5-5-5s-5,2.243-5,5,2.243,5,5,5,5-2.243,5-5Zm-5-4c-.828,0-1.5,.672-1.5,1.5s.672,1.5,1.5,1.5,1.5-.672,1.5-1.5-.672-1.5-1.5-1.5Zm0,4c-.552,0-1,.448-1,1v2c0,.552,.448,1,1,1s1-.448,1-1v-2c0-.552-.448-1-1-1Zm-7-6c0-.552-.448-1-1-1H5c-.552,0-1,.448-1,1s.448,1,1,1h4c.552,0,1-.448,1-1Z" />
    );
  }
}

export default asIcon(IconTermsInfo);
