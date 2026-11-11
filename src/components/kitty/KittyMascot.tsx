import type React from "react";
import { useEffect, useId, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
const Confetti = lazy(() => import("./MascotConfetti"));

// Kitty the cat butler: a sleek black ink silhouette with white negative space, almond half-lidded eyes,
// a bow tie and one white glove, standing behind a kraft gift box tied with a PayPal blue ribbon.
// Inline SVG, motion/react only. Eyes are thin path shapes (no circles or ellipses).

export type MascotState = "idle" | "chipIn" | "searching" | "ranking" | "vote" | "veto" | "buying" | "done" | "cancelled";

const SPRING = { type: "spring" as const, stiffness: 170, damping: 18, mass: 0.9 };
const LIMB = { type: "spring" as const, stiffness: 120, damping: 14, mass: 1 }; // softer, so limbs follow through
const SNAP = { type: "spring" as const, stiffness: 620, damping: 12 };
const SILK = [0.65, 0, 0.35, 1] as const; // dancer-like ease in-out
const INK = "var(--foreground)";
const KRAFT = "var(--kraft)";
const KRAFT_DEEP = "var(--kraft-deep)";
const PAPER = "var(--card)";
export const PAYPAL_BLUES = ["#003087", "#0070E0", "#009CDE"];

// Right arm pose: shoulder rotation and elbow rotation, in degrees.
const ARM: Record<MascotState, { a: number; b: number }> = {
  idle: { a: 0, b: 0 },
  chipIn: { a: -8, b: -6 },
  searching: { a: -100, b: -108 },
  ranking: { a: -40, b: -20 },
  vote: { a: -120, b: 30 },
  veto: { a: -22, b: -10 },
  buying: { a: -55, b: 45 },
  done: { a: 20, b: -40 },
  cancelled: { a: -130, b: 0 },
};

type Prop = "giftA" | "giftB" | "coin" | "card";
// Little things Kitty handles. Drawn in forearm space so they travel with the glove.
const PROPS: Record<Prop, React.ReactNode> = {
  giftA: (<g><rect x={123} y={106} width={15} height={14} rx={1.5} fill={KRAFT} stroke={INK} strokeWidth={1.5} /><path d="M130.5 106 V120" stroke={PAYPAL_BLUES[1]} strokeWidth={2.4} /></g>),
  giftB: (<g><path d="M124 108 H136 V119 C136 121 124 121 124 119 Z" fill={PAPER} stroke={INK} strokeWidth={1.5} /><path d="M136 110 C140 110 140 116 136 116" fill="none" stroke={INK} strokeWidth={1.5} /></g>),
  coin: (<g><circle cx={131} cy={115} r={6} fill={KRAFT_DEEP} stroke={INK} strokeWidth={1.5} /><path d="M131 112 V118" stroke={INK} strokeWidth={1.2} strokeLinecap="round" /></g>),
  card: (<rect x={123} y={100} width={14} height={19} rx={2} fill={PAPER} stroke={INK} strokeWidth={1.6} />),
};

// Choreographed loops: shoulder (a) and elbow (b) keyframes with props shown/hidden on the same timeline.
type Act = { a: number[]; b: number[]; dur: number; times: number[]; props?: { k: Prop; o: number[] }[] };
const ACTS: Partial<Record<MascotState, Act>> = {
  // Count the takings: dip into the box, lift a coin to admire it, drop it back.
  idle: { dur: 8, times: [0, 0.55, 0.65, 0.75, 0.88, 1], a: [0, 0, 20, -45, -45, 0], b: [0, 0, 10, -60, -60, 0],
    props: [{ k: "coin", o: [0, 0, 0, 1, 1, 0] }] },
  // Catch the coin, show it off, pop it in the box.
  chipIn: { dur: 2.4, times: [0, 0.3, 0.6, 0.85, 1], a: [-8, -70, -70, 10, -8], b: [-6, -50, -50, 10, -6],
    props: [{ k: "coin", o: [0, 1, 1, 0, 0] }] },
  // Pick a gift up, inspect it at eye level, put it down, pick up another.
  searching: { dur: 6, times: [0, 0.15, 0.4, 0.5, 0.65, 0.9, 1], a: [10, -95, -95, 10, -95, -95, 10], b: [10, -105, -105, 10, -105, -105, 10],
    props: [{ k: "giftA", o: [1, 1, 1, 0, 0, 0, 1] }, { k: "giftB", o: [0, 0, 0, 1, 1, 1, 0] }] },
  // Take a card from the row, consider it, file it into the box.
  ranking: { dur: 3.6, times: [0, 0.25, 0.5, 0.75, 1], a: [-40, -75, -75, 15, -40], b: [-20, -30, -30, 15, -20],
    props: [{ k: "card", o: [0, 1, 1, 0, 0] }] },
  // Paw hovers, then two dainty taps on the bell.
  veto: { dur: 3, times: [0, 0.5, 0.6, 0.7, 0.8, 1], a: [-22, -22, -8, -22, -8, -22], b: [-10, -10, 4, -10, 4, -10] },
  // Wrapping: pull the ribbon down, loop it over, tug it tight.
  buying: { dur: 3, times: [0, 0.24, 0.45, 0.7, 1], a: [-55, 15, -70, -30, -55], b: [45, 30, 60, 80, 45] },
};

const TAIL = {
  s1: "M66 160 C42 158 30 142 38 126 C46 110 34 94 20 92",
  s2: "M66 160 C44 164 24 150 32 132 C40 114 28 100 14 104",
  s3: "M66 160 C38 152 42 132 46 120 C52 102 42 88 30 80",
  low: "M66 160 C46 166 30 164 22 156 C14 148 16 140 22 136",
  high: "M66 160 C40 150 34 120 44 98 C52 80 46 66 34 60",
};

export function KittyMascot({ state = "idle", fill = 0, size = 72, className, label, wink: forceWink = false }: { state?: MascotState; fill?: number; size?: number; className?: string | undefined; label?: string; wink?: boolean }) {
  const reduce = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const grad = `rb-${uid}`;
  const s = state;
  const blinking = useBlink(!reduce && s !== "buying");
  const coins = Math.max(0, Math.min(5, Math.round(Math.max(0, Math.min(1, fill)) * 5)));
  const loop = (d: number, delay = 0) => (reduce ? { duration: 0 } : { duration: d, repeat: Infinity, ease: SILK, delay });
  const R = (live: any, still: any): any => (reduce ? still : live); // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = (tr: object) => (reduce ? { duration: 0 } : tr);

  const lidClosed = blinking || forceWink || s === "done";
  // Pupil glance: searching glides left and right, veto looks sideways at the viewer.
  const glance = s === "veto" ? 2.4 : s === "ranking" ? 1.6 : 0;
  const arm = ARM[s];
  const tailD = s === "idle" || s === "chipIn" ? R([TAIL.s1, TAIL.s2, TAIL.s3, TAIL.s1], TAIL.s1)
    : s === "done" || s === "buying" || s === "vote" ? TAIL.high
    : s === "cancelled" ? TAIL.low
    : R([TAIL.s3, TAIL.s1, TAIL.s3], TAIL.s3);
  const ribbonOn = s !== "cancelled";
  const act = reduce ? undefined : ACTS[s];

  return (
    <span className={className} style={{ display: "inline-block", width: size, height: size }} role="img" aria-label={label ?? `Kitty, ${describe(s)}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg key={reduce ? s : "live"} viewBox="0 0 200 200" width={size} height={size}
          initial={reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} exit={reduce ? { opacity: 0 } : {}}
          transition={{ duration: 0.25 }} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={PAYPAL_BLUES[0]} />
              <stop offset="55%" stopColor={PAYPAL_BLUES[1]} />
              <stop offset="100%" stopColor={PAYPAL_BLUES[2]} />
            </linearGradient>
          </defs>

          {/* Tail leads the motion: it moves first, limbs follow a beat later. */}
          <motion.path d={TAIL.s1} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round"
            animate={{ d: tailD }}
            transition={Array.isArray(tailD) ? { duration: 5.5, repeat: Infinity, ease: SILK } : t({ duration: 0.9, ease: SILK })} />

          {/* Three little cards (ranking), arranged by the glove */}
          {s === "ranking" && [0, 1, 2].map((i) => (
            <motion.rect key={i} y={88} width={16} height={22} rx={2.5} fill={PAPER} stroke={INK} strokeWidth={1.8}
              initial={{ x: 128 + i * 18, opacity: 0 }}
              animate={R({ x: [128 + i * 18, 128 + ((i + 1) % 3) * 18, 128 + ((i + 2) % 3) * 18, 128 + i * 18], opacity: 1, rotate: [-4 + i * 4, 0, 4 - i * 4, -4 + i * 4] }, { x: 128 + i * 18, opacity: 1, rotate: -4 + i * 4 })}
              transition={reduce ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: SILK, delay: i * 0.08 }} />
          ))}

          {/* The butler */}
          <motion.g animate={{ y: s === "buying" ? 2 : 0 }} transition={SPRING}>
            {/* torso, breathing */}
            <motion.g style={{ originX: "98px", originY: "132px", transformBox: "view-box" }}
              animate={{ scaleY: s === "idle" ? R([1, 1.018, 1], 1) : s === "done" ? 0.94 : 1 }}
              transition={s === "idle" ? loop(4.2) : SPRING}>
              <path d="M86 68 C78 84 74 108 76 134 L120 134 C122 108 116 84 106 68 Z" fill={INK} />
              <path d="M90 71 L97 102 L104 71 Z" fill={PAPER} />
              {/* bow tie */}
              <path d="M91 75 L97 78.5 L91 82 Z M103 75 L97 78.5 L103 82 Z M95.8 77.2 H98.2 V79.8 H95.8 Z" fill={INK} />
              {/* left arm, paw resting on the box */}
              <motion.path d="M84 86 C78 100 76 114 80 128" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round"
                animate={{ d: s === "done" ? "M84 86 C82 98 88 106 96 104" : "M84 86 C78 100 76 114 80 128" }} transition={t(LIMB)} />
            </motion.g>

            {/* head */}
            <motion.g style={{ originX: "96px", originY: "70px", transformBox: "view-box" }}
              animate={
                s === "chipIn" ? R({ rotate: [0, 9, 0], y: [0, 3, 0] }, { rotate: 6, y: 2 })
                : s === "done" ? R({ y: [0, 10, 10, 0], rotate: [0, 6, 6, 0] }, { y: 10, rotate: 6 })
                : { rotate: s === "ranking" ? 9 : s === "veto" ? -5 : s === "searching" ? -3 : s === "cancelled" ? -4 : 0, y: s === "idle" ? R([0, -0.8, 0], 0) : 0 }
              }
              transition={s === "chipIn" ? loop(1.7, 0.35) : s === "done" ? loop(2.8, 0.15) : s === "idle" ? loop(4.2) : { ...SPRING, delay: 0.06 }}>
              <path d="M76 56 C74 46 76 36 80 30 L82 14 L92 27 C94 26.5 98 26.5 100 27 L110 14 L112 30 C116 36 118 46 116 56 C114 66 106 72 96 72 C86 72 78 66 76 56 Z" fill={INK} />
              {/* inner ears */}
              <path d="M83.5 20 L84.5 28 L89 26 Z M108.5 20 L107.5 28 L103 26 Z" fill={PAPER} opacity={0.22} />
              {/* almond eyes: white negative space with ink slit pupils, half-lidded */}
              <Eye d="M81 46.5 C84 42.6 89 42.6 92 46 C89 48.6 84 48.8 81 46.5 Z" cx={86.5} closed={lidClosed} glance={glance} scan={s === "searching" && !reduce} />
              <Eye d="M100 46 C103 42.6 108 42.6 111 46.5 C108 48.8 103 48.6 100 46 Z" cx={105.5} closed={blinking} glance={glance} scan={s === "searching" && !reduce} />
              {/* brows: the right one lifts for veto and searching */}
              <path d="M81 40.5 C84 39 88 39 92 40.6" fill="none" stroke={PAPER} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
              <motion.path d="M100 40.6 C104 39 108 39 111 40.5" fill="none" stroke={PAPER} strokeWidth={1.2} strokeLinecap="round" opacity={0.85}
                style={{ originX: "105px", originY: "40px", transformBox: "view-box" }}
                animate={{ y: s === "veto" || s === "searching" ? -3 : 0, rotate: s === "veto" ? -10 : 0 }} transition={SPRING} />
              {/* nose and whiskers */}
              <path d="M94 55 L98 55 L96 57.4 Z" fill={PAPER} />
              <path d="M90 58 L79 56.5 M90 60.5 L80 61.5 M102 58 L113 56.5 M102 60.5 L112 61.5" stroke={PAPER} strokeWidth={0.8} strokeLinecap="round" opacity={0.7} />
              {/* monocle on the right eye while searching */}
              {s === "searching" && <path d="M105.5 38 A8.5 8.5 0 1 1 105.4 38 Z M113 52 C116 60 114 68 110 74" fill="none" stroke={PAPER} strokeWidth={1.4} />}
            </motion.g>

            {/* right arm: choreographed per state (pick up, inspect, put down, catch coins, ring, tug ribbon) */}
            <motion.g style={{ originX: "112px", originY: "86px", transformBox: "view-box" }}
              animate={{ rotate: act ? act.a : arm.a }}
              transition={act ? { duration: act.dur, times: act.times, repeat: Infinity, ease: SILK } : { ...LIMB, delay: reduce ? 0 : 0.08 }}>
              <path d="M112 86 L124 106" stroke={INK} strokeWidth={7} strokeLinecap="round" />
              <motion.g style={{ originX: "124px", originY: "106px", transformBox: "view-box" }}
                animate={act ? { rotate: act.b } : s === "cancelled" ? { rotate: R([-25, 20, -25], 0) } : { rotate: arm.b }}
                transition={act ? { duration: act.dur, times: act.times, repeat: Infinity, ease: SILK } : s === "cancelled" ? loop(1.3) : { ...LIMB, delay: reduce ? 0 : 0.16 }}>
                <path d="M124 106 L130 124" stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
                {/* props held in the glove */}
                {act?.props?.map((pr, i) => (
                  <motion.g key={`${s}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: pr.o }}
                    transition={{ duration: act.dur, times: act.times, repeat: Infinity, ease: "linear" }}>
                    {PROPS[pr.k]}
                  </motion.g>
                ))}
                {/* white glove */}
                <path d="M126 122 C126 118 134 118 135 122 C138 123 138 127 135 128.5 C134 132 127 132 126 128.5 C123.5 127 123.5 123.5 126 122 Z" fill={PAPER} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                <path d="M128.5 124.5 L132.5 124.5 M128 127 L133 127" stroke={INK} strokeWidth={0.9} strokeLinecap="round" opacity={0.6} />
                {/* ballot card presented with a flourish */}
                {s === "vote" && (
                  <motion.g initial={{ opacity: 0, rotate: -30 }} animate={{ opacity: 1, rotate: 0 }} transition={t(SNAP)}
                    style={{ originX: "131px", originY: "122px", transformBox: "view-box" }}>
                    <path d="M126 96 H146 V120 H126 Z" fill={PAPER} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
                    <path d="M130.5 108 L135 112.5 L142 103" fill="none" stroke={PAYPAL_BLUES[1]} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                  </motion.g>
                )}
              </motion.g>
            </motion.g>
          </motion.g>

          {/* Coins inside, peeking over the rim as the pot fills; they float out when cancelled */}
          {Array.from({ length: coins }).map((_, i) => (
            <motion.circle key={i} cx={74 + i * 14} cy={130} r={6} fill={KRAFT_DEEP} stroke={INK} strokeWidth={1.6}
              initial={{ y: 8 }} animate={{ y: s === "cancelled" ? R(-80 - i * 10, -18) : 0, opacity: s === "cancelled" ? R(0, 0.6) : 1 }}
              transition={s === "cancelled" ? t({ duration: 2, delay: i * 0.15, ease: SILK }) : SPRING} />
          ))}

          {/* Box */}
          <rect x={58} y={128} width={102} height={54} rx={5} fill={KRAFT} stroke={INK} strokeWidth={2} />
          <path d="M58 138 L160 138" stroke={KRAFT_DEEP} strokeWidth={1.2} opacity={0.5} />
          <motion.rect x={102} y={128} width={14} height={54} fill={`url(#${grad})`}
            style={{ originX: "109px", originY: "128px", transformBox: "view-box" }}
            initial={false}
            animate={{ scaleY: ribbonOn ? (s === "buying" ? R([0, 1], 1) : 1) : 0, opacity: ribbonOn ? 1 : 0 }}
            transition={s === "buying" ? t({ duration: 0.7, ease: SILK, repeat: Infinity, repeatDelay: 2.3 }) : t({ duration: 0.9, ease: SILK })} />

          {/* Bell on the lid (veto) */}
          <AnimatePresence>
            {s === "veto" && (
              <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
                <path d="M136 128 C136 120 141 116 146 116 C151 116 156 120 156 128 Z" fill={INK} />
                <path d="M133 128 H159" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
                <path d="M146 113 V116" stroke={INK} strokeWidth={2} strokeLinecap="round" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Coin dropping in (chip-in) */}
          <AnimatePresence>
            {s === "chipIn" && (
              <motion.g key="coin" initial={{ y: -90, opacity: 0 }}
                animate={R({ y: [-90, 0, -6, 0], opacity: [0, 1, 1, 0] }, { y: 0, opacity: 1 })}
                transition={reduce ? { duration: 0 } : { duration: 1.2, times: [0, 0.55, 0.75, 1], ease: "easeOut", repeat: Infinity, repeatDelay: 0.5 }}>
                <circle cx={84} cy={122} r={7} fill={KRAFT_DEEP} stroke={INK} strokeWidth={1.8} />
                <path d="M84 118 L84 126" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Bow: snaps tight when buying, bounces when done, unties when cancelled */}
          <motion.g style={{ originX: "109px", originY: "128px", transformBox: "view-box" }} initial={false}
            animate={
              s === "cancelled" ? { scale: R(0, 0.6), rotate: 50, opacity: R(0, 0.4) }
              : s === "buying" ? { scale: R([0, 0, 1.25, 1], 1), rotate: 0, opacity: 1 }
              : s === "done" ? { scale: 1.1, y: R([0, -7, 0], 0), rotate: 0, opacity: 1 }
              : { scale: 1, y: 0, rotate: 0, opacity: 1 }
            }
            transition={
              s === "buying" ? t({ duration: 3, times: [0, 0.24, 0.3, 0.36], ease: "easeOut", repeat: Infinity })
              : s === "done" ? { y: loop(1, 0.4), scale: SNAP }
              : t({ duration: 0.8, ease: SILK })
            }>
            <path d="M109 128 C94 112 82 120 88 130 C92 136 102 132 109 128 Z" fill={`url(#${grad})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            <path d="M109 128 C124 112 136 120 130 130 C126 136 116 132 109 128 Z" fill={`url(#${grad})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            <path d="M104.5 124.5 H113.5 V131.5 H104.5 Z" fill={`url(#${grad})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          </motion.g>

          {s === "done" && !reduce && <Suspense fallback={null}><Confetti colors={[...PAYPAL_BLUES, "#C9A27E"]} /></Suspense>}
        </motion.svg>
      </AnimatePresence>
    </span>
  );
}

/** One almond eye: a white path with an ink slit pupil (both paths). The lid closes by scaling the group. */
function Eye({ d, cx, closed, glance, scan }: { d: string; cx: number; closed: boolean; glance: number; scan: boolean }) {
  return (
    <motion.g style={{ originX: `${cx}px`, originY: "46px", transformBox: "view-box" }} animate={{ scaleY: closed ? 0.12 : 1 }} transition={{ duration: 0.18, ease: SILK }}>
      <path d={d} fill={PAPER} />
      <motion.path d={`M${cx} 43.4 C${cx + 1} 45 ${cx + 1} 46.6 ${cx} 48.2 C${cx - 1} 46.6 ${cx - 1} 45 ${cx} 43.4 Z`} fill={INK}
        animate={scan ? { x: [-3, 3, -3] } : { x: glance }}
        transition={scan ? { duration: 2.6, repeat: Infinity, ease: SILK } : SPRING} />
      {/* heavy upper lid keeps the look half-lidded and unbothered */}
      <path d={`M${cx - 5.6} 45.6 C${cx - 2} 43.6 ${cx + 2} 43.6 ${cx + 5.6} 45.6`} fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
    </motion.g>
  );
}

function useBlink(on: boolean) {
  const [b, setB] = useState(false);
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        setB(true);
        t = setTimeout(() => { setB(false); next(); }, 260);
      }, 4200 + Math.random() * 3000);
    };
    next();
    return () => clearTimeout(t);
  }, [on]);
  return b;
}

function describe(s: MascotState) {
  return {
    idle: "standing by the gift box",
    chipIn: "nodding as a coin drops in",
    searching: "searching the shops through a monocle",
    ranking: "arranging the picks",
    vote: "presenting the ballot",
    veto: "hovering over the bell",
    buying: "tying the bow on the gift",
    done: "taking a bow",
    cancelled: "waving goodbye",
  }[s];
}

/** Map real pot data to a mascot state. */
export function mascotStateFor(o: { status: string; working?: string | null | undefined; busy?: boolean; latestKind?: string | null; latestAt?: string | null }): MascotState {
  if (o.status === "cancelled") return "cancelled";
  if (o.status === "done") return "done";
  if (o.status === "buying") return "buying";
  if (o.status === "veto") return "veto";
  if (o.status === "voting") return "vote";
  if (o.working) return /weigh|scor|rank|reshuff/i.test(o.working) ? "ranking" : "searching";
  if (o.busy) return "searching";
  const fresh = o.latestAt ? Date.now() - new Date(o.latestAt).getTime() < 30_000 : false;
  if (fresh && o.latestKind) {
    if (o.latestKind === "contribution_held") return "chipIn";
    if (o.latestKind === "reranked") return "ranking";
    if (["planned", "searched", "band_crossed", "final_search"].includes(o.latestKind)) return "searching";
  }
  return "idle";
}
