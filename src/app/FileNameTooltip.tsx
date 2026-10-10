"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./FileTabs.module.css";

interface FileNameTooltipProps {
  anchor: HTMLElement;
  originalName: string;
  id: string;
  onDismiss: () => void;
}

export default function FileNameTooltip({ anchor, originalName, id, onDismiss }: FileNameTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const bounds = anchor.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    tooltip.style.maxWidth = `${Math.max(1, Math.min(420, window.innerWidth - margin * 2))}px`;
    const fullHeight = tooltip.getBoundingClientRect().height;
    const below = Math.max(0, window.innerHeight - bounds.bottom - gap - margin);
    const above = Math.max(0, bounds.top - gap - margin);
    const placeBelow = fullHeight <= below || (fullHeight > above && below >= above);
    const availableHeight = placeBelow ? below : above;
    tooltip.style.maxHeight = `${availableHeight}px`;
    const size = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(margin, Math.min(bounds.left, window.innerWidth - margin - size.width))}px`;
    tooltip.style.top = `${placeBelow ? bounds.bottom + gap : bounds.top - gap - size.height}px`;
    tooltip.style.visibility = availableHeight > 0 ? "visible" : "hidden";

    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    window.visualViewport?.addEventListener("resize", onDismiss);
    window.visualViewport?.addEventListener("scroll", onDismiss);
    return () => {
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
      window.visualViewport?.removeEventListener("resize", onDismiss);
      window.visualViewport?.removeEventListener("scroll", onDismiss);
    };
  }, [anchor, originalName, onDismiss]);

  return createPortal(
    <div ref={tooltipRef} id={id} role="tooltip" className={styles.originalNameTooltip}>
      {originalName}
    </div>,
    document.body,
  );
}
