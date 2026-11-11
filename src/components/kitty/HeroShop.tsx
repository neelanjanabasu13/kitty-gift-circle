import { motion, useReducedMotion } from "motion/react";

/**
 * Home page scene: Kitty walks along a shelf of gifts, picks each one up to inspect it, puts it down,
 * then takes the chocolates and pounces into the kraft box. One looping timeline drives every part.
 */
const DUR = 18;
const INK = "var(--foreground)";
const PAPER = "var(--card)";
const KRAFT = "#C9A27E";

// Shelf slots as % of the scene width, and the stop windows (fractions of the loop) at each one.
const ITEMS = [
  { key: "camera", x: 14, stop: [0.1, 0.18] },
  { key: "mug", x: 33, stop: [0.27, 0.35] },
  { key: "pan", x: 52, stop: [0.44, 0.52] },
  { key: "chocs", x: 70, stop: [0.61, 0.7] },
] as const;
const BOX_X = 88;

// Kitty's path: walk to each item, pause, walk on; then pounce into the box.
const CAT_T = [0, 0.08, 0.2, 0.25, 0.37, 0.42, 0.54, 0.59, 0.71, 0.76, 0.8, 0.95, 1];
const CAT_X = ["2%", "8%", "8%", "27%", "27%", "46%", "46%", "64%", "64%", "74%", "82%", "82%", "2%"];
const CAT_Y = [0, 0, 0, 0, 0, 0, 0, 0, 0, -70, -34, -34, 0];
const CAT_O = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0];

export function HeroShop({ className }: { className?: string }) {
  const reduce = !!useReducedMotion();
  const loop = (times: number[]) => ({ duration: DUR, times, repeat: Infinity, ease: "easeInOut" as const });

  return (
    <div role="img" aria-label="Kitty walks along a shelf, picks up a camera, a mug, a pan and chocolates one by one, then pounces into the gift box" className={`relative mx-auto h-[190px] w-full max-w-[560px] ${className ?? ""}`}>
      {/* shelf */}
      <div className="absolute inset-x-0 bottom-6 h-px bg-foreground/20" />

      {ITEMS.map((it) => {
        const [a, b] = it.stop;
        const carried = it.key === "chocs";
        const times = carried ? [0, a, a + 0.03, b, 0.76, 0.8, 0.95, 1] : [0, a, a + 0.03, b - 0.03, b, 1];
        const y = carried ? [0, 0, -62, -62, -110, -54, -54, 0] : [0, 0, -62, -62, 0, 0];
        const left = carried ? [`${it.x}%`, `${it.x}%`, `${it.x}%`, `${it.x}%`, "80%", `${BOX_X}%`, `${BOX_X}%`, `${it.x}%`] : undefined;
        const rot = carried ? [0, 0, -8, 6, 0, 0, 0, 0] : [0, 0, -10, 8, 0, 0];
        const op = carried ? [1, 1, 1, 1, 1, 1, 0, 1] : [1, 1, 1, 1, 1, 1];
        return (
          <motion.div key={it.key} className="absolute bottom-6 z-10 -ml-5 w-10"
            style={{ left: `${it.x}%` }}
            animate={reduce ? {} : { y, rotate: rot, opacity: op, ...(left ? { left } : {}) }}
            transition={reduce ? {} : loop(times)}>
            <Item k={it.key} />
          </motion.div>
        );
      })}

      {/* kraft box with the PayPal blue ribbon */}
      <div className="absolute bottom-6 -ml-9 w-[72px]" style={{ left: `${BOX_X}%` }}>
        <svg viewBox="0 0 72 54" className="block w-full">
          <defs>
            <linearGradient id="hs-ribbon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#003087" /><stop offset=".5" stopColor="#0070E0" /><stop offset="1" stopColor="#009CDE" /></linearGradient>
          </defs>
          <rect x="2" y="12" width="68" height="40" rx="4" fill={KRAFT} stroke={INK} strokeWidth="2.5" />
          <rect x="31" y="12" width="10" height="40" fill="url(#hs-ribbon)" />
          <path d="M36 12 C26 0 18 6 24 12 Z M36 12 C46 0 54 6 48 12 Z" fill="url(#hs-ribbon)" />
        </svg>
      </div>

      {/* Kitty */}
      <motion.div className="absolute bottom-6 w-[92px]"
        style={{ left: "8%" }}
        animate={reduce ? {} : { left: CAT_X, y: CAT_Y, opacity: CAT_O }}
        transition={reduce ? {} : loop(CAT_T)}>
        <motion.div animate={reduce ? {} : { y: [0, -3, 0] }} transition={reduce ? {} : { duration: 0.45, repeat: Infinity, ease: "easeInOut" }}>
          <WalkingCat reduce={reduce} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function WalkingCat({ reduce }: { reduce: boolean }) {
  const leg = (delay: number) => (reduce ? {} : { animate: { rotate: [14, -14, 14] }, transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" as const, delay } });
  return (
    <svg viewBox="0 0 120 100" className="block w-full overflow-visible">
      {/* tail leads the motion */}
      <motion.path d="M22 52 C6 46 4 26 14 16" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round"
        style={{ originX: "22px", originY: "52px" }}
        {...(reduce ? {} : { animate: { rotate: [0, 10, -6, 0] }, transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const } })} />
      {/* legs */}
      {[34, 44, 72, 82].map((x, i) => (
        <motion.rect key={x} x={x - 3} y="60" width="6" height="30" rx="3" fill={INK} style={{ originX: `${x}px`, originY: "60px" }} {...leg(i % 2 ? 0.45 : 0)} />
      ))}
      {/* white glove on the front paw */}
      <rect x="77" y="84" width="10" height="7" rx="3.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      {/* body */}
      <path d="M22 50 C24 38 40 34 60 36 C78 37 88 40 92 48 C96 58 88 66 70 66 L36 66 C26 66 20 60 22 50 Z" fill={INK} />
      {/* head */}
      <path d="M86 40 C84 26 90 16 100 15 L103 4 L108 15 C114 17 118 24 116 32 C114 42 104 46 96 46 C91 46 87 44 86 40 Z" fill={INK} />
      <path d="M92 15 L94 4 L100 15 Z" fill={INK} />
      {/* almond, half-lidded eye */}
      <path d="M103 26 C106 23.5 110 23.5 112 26 C110 28 106 28.2 103 26 Z" fill={PAPER} />
      <path d="M107.4 24.4 L107.4 27.6" stroke={INK} strokeWidth="1.4" />
      <path d="M102.5 24.6 C106 22 110 22 112.5 24.6" fill="none" stroke={INK} strokeWidth="2" />
      {/* raised brow and whiskers */}
      <path d="M103 20 C106 18 109 18 112 19.5" fill="none" stroke={PAPER} strokeWidth="1.2" />
      <path d="M112 34 L124 32 M112 36 L124 37" stroke={PAPER} strokeWidth=".9" />
      {/* bow tie */}
      <path d="M90 46 L84 42 L84 52 Z M90 46 L96 42 L96 52 Z" fill={PAPER} stroke={INK} strokeWidth="1" />
    </svg>
  );
}

function Item({ k }: { k: "camera" | "mug" | "pan" | "chocs" }) {
  const s = { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 40 32" className="block w-full">
      {k === "camera" && (<><rect x="4" y="9" width="32" height="20" rx="3" {...s} fill={PAPER} /><path d="M12 9 L15 4 H25 L28 9" {...s} /><circle cx="20" cy="19" r="6" {...s} /><rect x="29" y="12" width="4" height="3" fill={INK} /></>)}
      {k === "mug" && (<><path d="M8 6 H28 V26 C28 29 26 30 24 30 H12 C10 30 8 29 8 26 Z" {...s} fill={PAPER} /><path d="M28 11 C35 11 35 22 28 22" {...s} /><path d="M14 2 C12 4 16 5 14 7 M20 2 C18 4 22 5 20 7" fill="none" stroke={INK} strokeWidth="1.2" /></>)}
      {k === "pan" && (<><path d="M2 16 H26 C26 24 22 28 14 28 C6 28 2 24 2 16 Z" fill={INK} /><path d="M26 18 H39" stroke={INK} strokeWidth="3.5" strokeLinecap="round" /></>)}
      {k === "chocs" && (<><rect x="3" y="12" width="34" height="18" rx="3" {...s} fill={KRAFT} /><path d="M20 12 V30 M3 21 H37" stroke="#0070E0" strokeWidth="2.5" /><path d="M20 12 C14 4 10 8 14 12 M20 12 C26 4 30 8 26 12" fill="none" stroke="#0070E0" strokeWidth="2" /></>)}
    </svg>
  );
}
