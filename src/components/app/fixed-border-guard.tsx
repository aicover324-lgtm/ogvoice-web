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

export function FixedBorderGuard() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const run = () => {
      const all = document.body.querySelectorAll<HTMLElement>("*");
      for (const el of all) clearFixedBottomBorder(el);
    };

    run();
    const obs = new MutationObserver(() => run());
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    const onResize = () => run();
    window.addEventListener("resize", onResize);

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
