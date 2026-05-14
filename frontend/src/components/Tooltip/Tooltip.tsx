import * as RadixTooltip from "@radix-ui/react-tooltip";
import React from "react";

import styles from "./Tooltip.module.scss";

interface Props {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export default function Tooltip({
  children,
  content,
  side = "bottom",
}: Props): React.ReactElement {
  return (
    <RadixTooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.content} side={side} sideOffset={8}>
            {content}
            <RadixTooltip.Arrow className={styles.arrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
