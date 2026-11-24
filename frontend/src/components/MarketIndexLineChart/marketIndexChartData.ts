export const GREEN = "#1aa260";
export const RED = "#d4493f";

// Darker than the stock charts' #aaa so tick labels meet the 4.5:1 text contrast rule.
export const MARKET_INDEX_AXIS_LABEL_STYLE = { color: "#566375", fontSize: 11 };
export const MARKET_INDEX_SPLIT_LINE_STYLE = { color: "#e6ebf0" };
export const MARKET_INDEX_GUIDE_LINE_COLOR = "#788596";
export const MARKET_INDEX_TOOLTIP_STYLE = {
  confine: true,
  backgroundColor: "rgba(255, 255, 255, 0.96)",
  borderColor: "#dbe4ef",
  borderWidth: 1,
  textStyle: { color: "#334155", fontSize: 12 },
};

// The left inset fits the first time or date label centred on the plot edge; the right
// inset fits point labels such as "23,100.5".
export const MARKET_INDEX_GRID = {
  left: 23,
  top: 12,
  right: 61,
  bottom: 20,
  outerBoundsMode: "none" as const,
};

// MKT-R14 treats a previous close of 0 as missing, so it gets no reference line or axis room.
export function getChartPreviousClose(prevClosePrice: number | null): number | null {
  return prevClosePrice === 0 ? null : prevClosePrice;
}

// Keeps a flat line or a lone point off the plot edges.
export function getMarketIndexAxisPadding(minPrice: number, maxPrice: number): number {
  return Math.max((maxPrice - minPrice) * 0.1, Math.abs(maxPrice) * 0.001, 0.01);
}

export function getMarketIndexMinPrice(
  data: [number, number | null][],
  prevClosePrice: number | null,
): number {
  return Math.min(
    ...data.flatMap(([, price]) => (price === null ? [] : [price])),
    ...(prevClosePrice === null ? [] : [prevClosePrice]),
  );
}

export function getMarketIndexMaxPrice(
  data: [number, number | null][],
  prevClosePrice: number | null,
): number {
  return Math.max(
    ...data.flatMap(([, price]) => (price === null ? [] : [price])),
    ...(prevClosePrice === null ? [] : [prevClosePrice]),
  );
}

export function splitMarketIndexDataIntoColoredSegments(
  data: [number, number | null][],
  prevClosePrice: number | null,
): Array<{ data: [number, number | null][]; color: string }> {
  if (data.length === 0) return [];
  if (prevClosePrice === null) return [{ data, color: "#4c8bf5" }];

  const segments: Array<{ data: [number, number | null][]; color: string }> = [];
  let currentSegment: [number, number | null][] = [];
  let currentColor: string | null = null;

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const value = point[1];
    const pointColor: string =
      value === null ? (currentColor ?? GREEN) : value > prevClosePrice ? RED : GREEN;

    if (
      currentColor !== null &&
      currentColor !== pointColor &&
      currentSegment.length > 0
    ) {
      const prevPoint = data[i - 1];
      const prevValue = prevPoint[1];

      if (prevValue !== null && value !== null) {
        const x1 = prevPoint[0];
        const y1 = prevValue;
        const x2 = point[0];
        const y2 = value;

        const t = (prevClosePrice - y1) / (y2 - y1);
        if (t > 0 && t < 1) {
          const intersectionX = x1 + t * (x2 - x1);
          const intersectionPoint: [number, number] = [intersectionX, prevClosePrice];

          currentSegment.push(intersectionPoint);
          segments.push({ data: [...currentSegment], color: currentColor });
          currentSegment = [intersectionPoint, point];
        } else {
          currentSegment.push(point);
          segments.push({ data: [...currentSegment], color: currentColor });
          currentSegment = [point];
        }
      } else {
        currentSegment.push(point);
        segments.push({ data: [...currentSegment], color: currentColor });
        currentSegment = [point];
      }
      currentColor = pointColor;
    } else {
      if (currentColor === null) {
        currentColor = pointColor;
      }
      currentSegment.push(point);
    }
  }

  if (currentSegment.length > 0 && currentColor !== null) {
    segments.push({ data: currentSegment, color: currentColor });
  }

  return segments;
}
