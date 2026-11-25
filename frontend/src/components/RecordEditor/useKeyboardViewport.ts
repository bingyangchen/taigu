import { useEffect, useState } from "react";

// The on-screen keyboard is the only common reason for the visual viewport to be
// this much shorter than the layout viewport while the page is not zoomed in.
const KEYBOARD_MIN_HEIGHT = 150;

// Pinch zoom also shrinks the visual viewport; a scale this close to 1 is not zoom.
const UNZOOMED_MAX_SCALE = 1.01;

export type KeyboardViewport = { height: number; offsetTop: number };

/** Returns the part of the screen the on-screen keyboard leaves visible, or null while it is closed. */
export function useKeyboardViewport(isEnabled: boolean): KeyboardViewport | null {
  const [viewport, setViewport] = useState<KeyboardViewport | null>(null);
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!isEnabled || !visualViewport) {
      setViewport(null);
      return;
    }
    const handleResize = (): void => {
      const isKeyboardOpen =
        visualViewport.scale <= UNZOOMED_MAX_SCALE &&
        window.innerHeight - visualViewport.height >= KEYBOARD_MIN_HEIGHT;
      const height = visualViewport.height;
      const offsetTop = visualViewport.offsetTop;

      // Scrolling fires this on every frame; keep the same object when nothing
      // changed so the editor does not re-render.
      setViewport((current) => {
        if (!isKeyboardOpen) return null;
        if (current && current.height === height && current.offsetTop === offsetTop) {
          return current;
        }
        return { height, offsetTop };
      });
    };
    handleResize();
    visualViewport.addEventListener("resize", handleResize);
    visualViewport.addEventListener("scroll", handleResize);
    return () => {
      visualViewport.removeEventListener("resize", handleResize);
      visualViewport.removeEventListener("scroll", handleResize);
    };
  }, [isEnabled]);
  return viewport;
}
