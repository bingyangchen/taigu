import type { KeyboardEvent } from "react";

/**
 * Whether the key press belongs to an input method's composition, such as the Enter
 * that confirms characters typed with Zhuyin or the arrow keys that pick a candidate.
 * Safari reports the confirming Enter with `isComposing` false, so `keyCode` 229
 * counts too.
 */
export function isImeComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/**
 * Returns the option an arrow key moves the highlight to, wrapping around at either
 * end. `highlightedIndex` is -1 when no option is highlighted, in which case Down
 * moves to the first option and Up to the last.
 */
export function getNextHighlightedIndex(
  highlightedIndex: number,
  offset: 1 | -1,
  optionCount: number,
): number {
  const currentIndex = highlightedIndex < 0 && offset < 0 ? 0 : highlightedIndex;
  return (currentIndex + offset + optionCount) % optionCount;
}
