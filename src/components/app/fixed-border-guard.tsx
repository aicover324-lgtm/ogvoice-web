"use client";

import * as React from "react";

function clearFixedBottomBorder(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  if (style.position !== "fixed") return;

  const rect = el.getBoundingClientRect();
  const spansMostWidth = rect.width >= window.innerWidth * 0.9;
  const anchoredBottom = Math.abs(window.innerHeight - rect.bottom) <= 2;
  const hasTopBorder = parseFloat(style.borderTopWidth || "0") > 0;
  const thinBarLike = rect.height <= 96;

  if (!spansMostWidth || !anchoredBottom || !thinBarLike) return;
  if (!hasTopBorder && style.boxShadow === "none") return;

  el.style.borderTopWidth = "0";
  el.style.borderTopColor = "transparent";
  el.style.boxShadow = "none";
}

function clearFullWidthHairline(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const spansMostWidth = rect.width >= window.innerWidth * 0.9;
  const veryThin = rect.height <= 2;
  if (!spansMostWidth || !veryThin) return;

  const hasLine =
    parseFloat(style.borderTopWidth || "0") > 0 ||
    parseFloat(style.borderBottomWidth || "0") > 0 ||
    style.backgroundColor !== "rgba(0, 0, 0, 0)";

  if (!hasLine) return;

  el.style.borderTopWidth = "0";
  el.style.borderBottomWidth = "0";
  el.style.borderTopColor = "transparent";
  el.style.borderBottomColor = "transparent";
  el.style.backgroundColor = "transparent";
  el.style.boxShadow = "none";
}

function clearElementsCrossingViewportLine(y: number) {
  if (y < 0 || y > window.innerHeight - 1) return;
  const xPoints = [8, Math.floor(window.innerWidth / 2), Math.max(8, window.innerWidth - 8)];
  for (const x of xPoints) {
    const stack = document.elementsFromPoint(x, y) as HTMLElement[];
    for (const el of stack) {
      clearFixedBottomBorder(el);
      clearFullWidthHairline(el);
    }
  }
}

export function FixedBorderGuard() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const run = () => {
      const all = document.body.querySelectorAll<HTMLElement>("*");
      for (const el of all) {
        clearFixedBottomBorder(el);
        clearFullWidthHairline(el);
      }

      const probeYs = [
        Math.floor(window.innerHeight * 0.5),
        Math.floor(window.innerHeight * 0.66),
        Math.floor(window.innerHeight * 0.8),
        Math.floor(window.innerHeight * 0.9),
        window.innerHeight - 2,
      ];
      for (const y of probeYs) clearElementsCrossingViewportLine(y);
    };

    run();
    const obs = new MutationObserver(() => run());
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    const onResize = () => run();
    const onScroll = () => run();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
