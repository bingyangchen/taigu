import logo from "../../assets/logo-no-bg.png";
import styles from "./FullLogo.module.scss";

interface Props {
  size: "s" | "m" | "l";
  translateX?: number;
}

const sizeToClassName: Record<Props["size"], string> = {
  s: styles.s,
  m: styles.m,
  l: styles.l,
};

export default function FullLogo({ size, translateX }: Props) {
  return (
    <div
      className={`${styles.main} ${sizeToClassName[size]}`}
      style={{ transform: `translateX(${translateX ?? 0}px)` }}
    >
      <img className={styles.logo} src={logo} alt="" />
    </div>
  );
}
