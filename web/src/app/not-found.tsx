import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="hero">
        <div className="wrap"><h1>Page not found</h1></div>
      </div>
      <main className="wrap">
        <p className="notes" style={{ paddingTop: 24 }}>
          That division or season isn&apos;t in the league records.{" "}
          <Link href="/">Go to the current Premier League table</Link>.
        </p>
      </main>
    </>
  );
}
