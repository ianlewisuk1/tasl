import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "TASL", template: "%s · TASL" },
  description: "Triangle Adult Soccer League tables, results and fixtures.",
};

export const viewport: Viewport = { themeColor: "#1e0021", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <header className="brand">
          <div className="wrap">
            <Link href="/" className="brandlink">
              <Image src="/tasl-logo.png" alt="TASL" width={48} height={48} priority className="logo" />
              <span>
                <b>Triangle Adult Soccer League</b>
                <small>North Carolina&apos;s largest adult soccer league</small>
              </span>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
