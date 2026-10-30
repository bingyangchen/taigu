// Subscription periods are counted in Taiwan time (BILL-R14), so dates on the plan
// page are shown in Taiwan time whatever the device's time zone.
const TAIWAN_TIME_ZONE = "Asia/Taipei";

export function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("zh-TW", {
    timeZone: TAIWAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * The end of the first period if the payment succeeded at `now`: a month or a year
 * later in Taiwan time, on the month's last day when it has no such day (BILL-R14).
 */
export function getFirstPeriodEndDate(interval: "month" | "year", now: Date): string {
  const partTypeToValue = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TAIWAN_TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(now)
      .map((part) => [part.type, Number(part.value)]),
  );
  const monthIndex = partTypeToValue.month - 1 + (interval === "year" ? 12 : 1);
  const endYear = partTypeToValue.year + Math.floor(monthIndex / 12);
  const endMonth = (monthIndex % 12) + 1;
  const lastDayOfMonth = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  const endDay = Math.min(partTypeToValue.day, lastDayOfMonth);
  return [endYear, endMonth, endDay]
    .map((part) => String(part).padStart(2, "0"))
    .join("/");
}
