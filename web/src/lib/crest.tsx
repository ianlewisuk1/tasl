import type { Team } from "./types";

// Kit colour text on TeamPass -> [fill, text, pattern]. Unknown or missing colours fall back to a stable palette.
const KIT: Record<string, [string, string, ("stripes" | "hoops")?]> = {
  "sky blue": ["#6cb4ee", "#0b2545"], "light blue": ["#6cb4ee", "#0b2545"], "baby blue": ["#89c4f4", "#0b2545"],
  blue: ["#1f4e9c", "#ffffff"], "royal blue": ["#1d4ed8", "#ffffff"], navy: ["#14254a", "#ffffff"], "navy blue": ["#14254a", "#ffffff"],
  red: ["#c8102e", "#ffffff"], maroon: ["#7a1f2b", "#ffffff"], burgundy: ["#6d1a2c", "#ffffff"], claret: ["#7a263a", "#ffffff"],
  white: ["#f3f4f6", "#1f2937"], black: ["#16161a", "#ffffff"], grey: ["#6b7280", "#ffffff"], gray: ["#6b7280", "#ffffff"],
  green: ["#15803d", "#ffffff"], "dark green": ["#14532d", "#ffffff"], "kelly green": ["#16a34a", "#ffffff"], "lime green": ["#84cc16", "#1a2e05"],
  yellow: ["#facc15", "#1f2937"], gold: ["#d4a017", "#1f2937"], orange: ["#f97316", "#ffffff"],
  purple: ["#6d28d9", "#ffffff"], pink: ["#ec4899", "#ffffff"], teal: ["#0f766e", "#ffffff"], "blue/white stripes": ["#1f4e9c", "#ffffff", "stripes"],
};
const FALLBACK: [string, string][] = [["#0f766e", "#ffffff"], ["#b45309", "#ffffff"], ["#334155", "#ffffff"], ["#7c3aed", "#ffffff"], ["#be185d", "#ffffff"]];

function kit(team: Team): [string, string, ("stripes" | "hoops")?] {
  const c = (team.colours ?? "").trim().toLowerCase();
  if (KIT[c]) return KIT[c];
  const first = c.split(/[\/,&]| and /)[0]?.trim();
  if (first && KIT[first]) return c.includes("stripe") ? [KIT[first][0], "#ffffff", "stripes"] : KIT[first];
  return FALLBACK[team.id % FALLBACK.length];
}

export function abbr(name: string): string {
  const words = name.replace(/^The\s+/i, "").split(/\s+/).filter((w) => w && !/^(FC|SC|AFC|CF)$/i.test(w));
  if (!words.length) return name.slice(0, 3).toUpperCase();
  return (words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join("").slice(0, 3)).toUpperCase();
}

const SHAPE = "M2 2h24v14c0 8-6 13-12 15C8 29 2 24 2 16z";

export function Crest({ team, size = 26 }: { team: Team; size?: number }) {
  const [fill, ink, pattern] = kit(team);
  const a = abbr(team.name);
  const clip = `crest-${team.id}`;
  return (
    <svg className="crest" viewBox="0 0 28 32" width={size} height={(size * 32) / 28} aria-hidden="true">
      <path d={SHAPE} fill={fill} stroke="rgba(255,255,255,.35)" strokeWidth={1} />
      {pattern === "stripes" && (
        <>
          <clipPath id={clip}><path d={SHAPE} /></clipPath>
          <g clipPath={`url(#${clip})`}>
            {[6, 14, 22].map((x) => <rect key={x} x={x - 2} y={0} width={4} height={34} fill={ink} />)}
          </g>
        </>
      )}
      <text
        x={14} y={18.5} textAnchor="middle" fontFamily="var(--font), sans-serif" fontWeight={800}
        fontSize={a.length > 2 ? 8.5 : 10.5}
        fill={pattern ? "#0b2545" : ink}
        {...(pattern ? { stroke: "#fff", strokeWidth: 2.4, paintOrder: "stroke" } : {})}
      >
        {a}
      </text>
    </svg>
  );
}
