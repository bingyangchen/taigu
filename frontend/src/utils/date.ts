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

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function formatDateWithWeekday(dateString: string | null): string {
  if (!dateString || dateString === "0000-00-00") return "-";
  const date = new Date(`${dateString}T00:00:00+08:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = WEEKDAY_NAMES[date.getDay()];
  return `${year}/${month}/${day} (${weekday})`;
}

export function dateToDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return dateToDateString(new Date());
}

export function getDaysBetween(fromDateString: string, toDateString: string): number {
  const millisecondsPerDay = 86400000;
  return Math.round(
    (dateStringToDate(toDateString).getTime() -
      dateStringToDate(fromDateString).getTime()) /
      millisecondsPerDay,
  );
}

export function getWeekdayName(dateString: string): string {
  return WEEKDAY_NAMES[dateStringToDate(dateString).getDay()];
}

export function isWeekend(dateString: string): boolean {
  const day = dateStringToDate(dateString).getDay();
  return day === 0 || day === 6;
}
