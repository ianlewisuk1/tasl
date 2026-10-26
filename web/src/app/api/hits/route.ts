// Old-school hit counter: each page load POSTs here and gets the new total back.
// Stored in Upstash Redis via its REST API. The Vercel Marketplace integration sets
// KV_REST_API_*; a project linked to Upstash directly gets UPSTASH_REDIS_REST_*.
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "tasl:hits";

export async function POST() {
  // No store configured (e.g. local dev): the footer hides the counter.
  if (!URL_ || !TOKEN) return Response.json({ hits: null });
  try {
    const res = await fetch(`${URL_}/incr/${KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ hits: null }, { status: 502 });
    const { result } = (await res.json()) as { result: number };
    return Response.json({ hits: result });
  } catch {
    return Response.json({ hits: null }, { status: 502 });
  }
}
