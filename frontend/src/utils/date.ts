export function getDateStringList(start: Date, end: Date): string[] {
  const result = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    // Do not drop weekend because sometimes the market would open on weekend
    result.push(date.toLocaleDateString("af"));
  }
  return result;
}

export function dateStringToDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map((e) => parseInt(e, 10));
  return new Date(year, month - 1, day);
}

export function formatDateWithWeekday(dateString: string | null): string {
  if (!dateString || dateString === "0000-00-00") return "-";
  const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;
  const date = new Date(`${dateString}T00:00:00+08:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return `${year}/${month}/${day} (${weekday})`;
}
