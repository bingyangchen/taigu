import styles from "./SpreadsheetMock.module.scss";

type CellKind = "text" | "error" | "stale";

interface Cell {
  value: string;
  kind?: CellKind;

  // The selected cell, which the formula bar shows.
  isSelected?: boolean;
}

// Columns B, E and F only show in layouts wide enough for every column.
const COLUMNS = [
  { letter: "A", label: "日期" },
  { letter: "B", label: "代號", isWideOnly: true },
  { letter: "C", label: "名稱" },
  { letter: "D", label: "股數" },
  { letter: "E", label: "成交價", isWideOnly: true },
  { letter: "F", label: "手續費", isWideOnly: true },
  { letter: "G", label: "金額" },
];

const ROWS: Cell[][] = [
  [
    { value: "2023/3/14", kind: "text" },
    { value: "2330", kind: "text" },
    { value: "台積電", kind: "text" },
    { value: "100" },
    { value: "518" },
    { value: "73" },
    { value: "-51,873" },
  ],
  [
    { value: "2023/6/20", kind: "text" },
    { value: "2412", kind: "text" },
    { value: "中華電", kind: "text" },
    { value: "1,000" },
    { value: "118.5" },
    { value: "168" },
    { value: "-118,668" },
  ],
  [
    { value: "2024/1/17", kind: "text" },
    { value: "878", kind: "text" },
    { value: "國泰永續", kind: "text" },
    { value: "5,000" },
    { value: "21.48" },
    { value: "=E4*D4*0.1425" },
    { value: "#VALUE!", kind: "error" },
  ],
  [
    { value: "2024/2/26", kind: "text" },
    { value: "2330", kind: "text" },
    { value: "台積電", kind: "text" },
    { value: "80" },
    { value: "683" },
    { value: "77" },
    { value: "-54,717" },
  ],
  [
    { value: "現價", kind: "text" },
    { value: "" },
    { value: "上次更新 10/3", kind: "stale" },
    { value: "" },
    { value: "" },
    { value: "" },
    { value: "" },
  ],
  [
    { value: "報酬率", kind: "text" },
    { value: "" },
    { value: "" },
    { value: "" },
    { value: "" },
    { value: "" },
    { value: "#NUM!", kind: "error", isSelected: true },
  ],
];

// An illustration of the spreadsheet a Taiwan-stock investor keeps by hand, with the
// errors such sheets typically show. It is drawn, not a screenshot, so it stays sharp
// and translatable; screen readers get its aria-label instead of the cells.
export default function SpreadsheetMock({ className }: { className?: string }) {
  const getColumnClassName = (columnIndex: number): string =>
    COLUMNS[columnIndex].isWideOnly ? styles.wide_only : "";

  return (
    <figure
      className={`${styles.main} ${className ?? ""}`}
      aria-label="示意：用試算表記錄台股時，手續費公式出錯、股價忘了更新，報酬率算不出來"
      role="img"
    >
      <div className={styles.formula_bar}>
        <i>fx</i>
        <code>=XIRR(G2:G41, A2:A41)</code>
      </div>
      <table>
        <thead>
          <tr>
            <th />
            {COLUMNS.map((column, columnIndex) => (
              <th key={column.letter} className={getColumnClassName(columnIndex)}>
                {column.letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className={styles.header_row}>
            <th>1</th>
            {COLUMNS.map((column, columnIndex) => (
              <td key={column.letter} className={getColumnClassName(columnIndex)}>
                {column.label}
              </td>
            ))}
          </tr>
          {ROWS.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th>{rowIndex + 2}</th>
              {row.map((cell, columnIndex) => (
                <td
                  key={columnIndex}
                  className={[
                    getColumnClassName(columnIndex),
                    cell.kind ? styles[cell.kind] : "",
                    cell.isSelected ? styles.selected : "",
                  ].join(" ")}
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
