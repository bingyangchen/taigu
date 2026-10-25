// The API sends days as "YYYY-MM-DD" and months as "YYYY-MM" in Taiwan time, so they
// are formatted as text instead of through Date, which would apply the viewer's time
// zone.

export function formatDate(isoDate: string): string {
  return isoDate.split("-").join("/");
}

export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function formatMonth(isoMonth: string): string {
  return isoMonth.replace("-", "/");
}

export function formatShortMonth(isoMonth: string): string {
  return isoMonth.slice(2).replace("-", "/");
}

const taiwanDateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatTaiwanDateTime(isoDateTime: string): string {
  const parts = Object.fromEntries(
    taiwanDateTimeFormat
      .formatToParts(new Date(isoDateTime))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString();
}
