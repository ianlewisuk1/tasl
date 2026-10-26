"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  ["tables", "Tables"],
  ["results", "Results"],
  ["fixtures", "Fixtures"],
] as const;

/** Top navigation. Section links keep the division and season you are looking at. */
export function MainNav({ seasonSlug, division, registerUrl }: { seasonSlug: string; division: string; registerUrl: string }) {
  const path = usePathname();
  const [, current, season, div] = path.split("/");
  const inSection = SECTIONS.some(([s]) => s === current);
  const target = (s: string) => `/${s}/${inSection ? season : seasonSlug}/${inSection ? div : division}`;
  return (
    <nav aria-label="Main">
      <Link href="/" className="navhome" aria-current={path === "/" ? "page" : undefined}>Home</Link>
      {SECTIONS.map(([s, label]) => (
        <Link key={s} href={target(s)} aria-current={current === s ? "page" : undefined}>{label}</Link>
      ))}
      <Link href="/clubs" aria-current={path.startsWith("/clubs") ? "page" : undefined}>Clubs</Link>
      <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="navcta">Register</a>
    </nav>
  );
}
