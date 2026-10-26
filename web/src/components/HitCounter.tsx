"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** "You are visitor No. 0012345": counts every page load, including client-side navigations. */
export function HitCounter() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  const [hits, setHits] = useState<number | null>(null);

  useEffect(() => {
    // Guard against React's dev double-run so one load counts once.
    if (last.current === pathname) return;
    last.current = pathname;
    fetch("/api/hits", { method: "POST" })
      .then((r) => r.json())
      .then((d: { hits: number | null }) => setHits(d.hits))
      .catch(() => {});
  }, [pathname]);

  if (hits === null) return null;
  const digits = String(hits).padStart(7, "0");
  return (
    <p className="hits" aria-label={`You are visitor number ${hits.toLocaleString("en-US")}`}>
      <span aria-hidden="true">You are visitor No.</span>
      <span className="odo" aria-hidden="true">
        {[...digits].map((d, i) => <i key={i}>{d}</i>)}
      </span>
    </p>
  );
}
