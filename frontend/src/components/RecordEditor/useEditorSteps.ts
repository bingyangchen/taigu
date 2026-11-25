import { useEffect, useRef, useState } from "react";

import type { StepState } from "./RecordEditor";

type Options<StepKey extends string, FocusTarget extends string> = {
  stepKeys: StepKey[];
  isCollapsible: boolean;
  isNew: boolean;
  initialFilled: Record<StepKey, boolean>;
  focusTargets: Record<StepKey | FocusTarget | "submit", () => void>;
};

export function useEditorSteps<StepKey extends string, FocusTarget extends string>({
  stepKeys,
  isCollapsible,
  isNew,
  initialFilled,
  focusTargets,
}: Options<StepKey, FocusTarget>) {
  type Target = StepKey | FocusTarget | "submit";
  const getFirstUnfilledStep = (
    filled: Record<StepKey, boolean>,
  ): StepKey | undefined => stepKeys.find((key) => !filled[key]);

  const [openStep, setOpenStep] = useState<StepKey | null>(() =>
    isNew ? (getFirstUnfilledStep(initialFilled) ?? null) : null,
  );

  // The narrow edit page does not move focus when it opens, so that the on-screen
  // keyboard does not cover the form before the user picks a field.
  const [focusRequest, setFocusRequest] = useState<{ target: Target } | null>(() =>
    isNew && !isCollapsible
      ? { target: getFirstUnfilledStep(initialFilled) ?? "submit" }
      : null,
  );
  const focusTargetsRef = useRef(focusTargets);
  focusTargetsRef.current = focusTargets;

  useEffect(() => {
    if (!focusRequest) return;
    focusTargetsRef.current[focusRequest.target]();
    setFocusRequest(null);
  }, [focusRequest]);

  const focus = (target: Target): void => setFocusRequest({ target });

  return {
    openStep,
    focus,
    getStepState: (key: StepKey, filled: Record<StepKey, boolean>): StepState =>
      isCollapsible && openStep === key ? "open" : filled[key] ? "done" : "todo",
    openStepAndFocus: (key: StepKey): void => {
      setOpenStep(key);
      focus(key);
    },
    showProblem: (key: StepKey, target: Target): void => {
      if (isCollapsible) setOpenStep(key);
      focus(target);
    },
    advance: (filled: Record<StepKey, boolean>): void => {
      const nextStep = getFirstUnfilledStep(filled);
      if (isCollapsible) setOpenStep(nextStep ?? null);
      focus(nextStep ?? "submit");
    },
    restart: (titleTarget: Target): void => {
      if (isCollapsible) {
        setOpenStep(stepKeys[0]);
        focus(titleTarget);
      } else {
        focus(stepKeys[0]);
      }
    },
  };
}
