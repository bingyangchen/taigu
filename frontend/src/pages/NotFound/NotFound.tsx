import React from "react";
import { Link } from "react-router-dom";

import Button from "../../components/Button/Button";
import Env from "../../utils/env";
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
    return (
      <main className={styles.main}>
        <section className={styles.content} aria-labelledby="not-found-title">
          <p className={styles.status}>404</p>
          <h1 id="not-found-title" className={styles.title}>
            找不到頁面
          </h1>
          <p className={styles.description}>
            這個網址可能已失效或不存在。請返回首頁，重新查看投資總覽與台股紀錄。
          </p>
          <Button asChild className={`primary_fill l ${styles.homeButton}`}>
            <Link to={Env.frontendRootPath}>返回首頁</Link>
          </Button>
        </section>
      </main>
    );
  }
}
