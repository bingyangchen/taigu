import React from "react";

import styles from "./NotFound.module.scss";

interface Props {}

interface State {}

export default class NotFound extends React.Component<Props, State> {
  public state: State;
  public constructor(props: Props) {
    super(props);
    this.state = {};
  }
  public componentDidMount(): void {}
  public render(): React.ReactNode {
    return <div className={styles.main}>404 Page Not Found</div>;
  }
}
