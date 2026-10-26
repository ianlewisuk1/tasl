import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { MainNav } from "@/components/MainNav";
import { DEFAULT_DIVISION, REGISTER_URL, getIndex } from "@/lib/data";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "TASL: Tables, Results & Fixtures", template: "%s · TASL" },
  description: "Triangle Adult Soccer League tables, results and fixtures.",
};

export const viewport: Viewport = { themeColor: "#1e0021", viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const index = await getIndex();
  const season = index.seasons.find((s) => s.isCurrent) ?? index.seasons[0];
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <header className="topnav">
          <div className="wrap">
            <Link href="/" className="brandlink" aria-label="TASL home">
              <Image src="/tasl-logo.png" alt="" width={32} height={48} priority className="logo" />
              <span>
                <b>TASL</b>
                <small>Triangle Adult Soccer League</small>
              </span>
            </Link>
            <MainNav seasonSlug={season.slug} division={DEFAULT_DIVISION} registerUrl={REGISTER_URL} />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
