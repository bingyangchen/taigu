export const GREEN = "#1aa260";
export const RED = "#d4493f";

export function getMarketIndexMinPrice(
  data: [number, number | null][],
  prevClosePrice: number,
): number {
  return Math.min(...data.map((point) => point[1] ?? prevClosePrice));
}

export function getMarketIndexMaxPrice(
  data: [number, number | null][],
  prevClosePrice: number,
): number {
  return Math.max(...data.map((point) => point[1] ?? prevClosePrice));
}

export function splitMarketIndexDataIntoColoredSegments(
  data: [number, number | null][],
  prevClosePrice: number,
): Array<{ data: [number, number | null][]; color: string }> {
  if (data.length === 0) return [];

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
