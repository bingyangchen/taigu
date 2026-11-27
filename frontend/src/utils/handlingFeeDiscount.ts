/** The title FEE-R5 gives a handling fee discount. */
export function getDiscountTitle(memo: string): string {
  return memo.trim() || "手續費折讓";
}
