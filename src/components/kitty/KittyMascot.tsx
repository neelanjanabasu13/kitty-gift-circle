import type React from "react";
import { useEffect, useId, useMemo, useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "motion/react";
const Confetti = lazy(() => import("./MascotConfetti"));

// Kitty the cat butler: a sleek black ink silhouette with white negative space, almond half-lidded eyes,
// a bow tie and one white glove, standing behind a kraft gift box tied with a PayPal blue ribbon.
// Inline SVG, motion/react only. Eyes are thin path shapes (no circles or ellipses).

export type MascotState = "idle" | "chipIn" | "counting" | "searching" | "ranking" | "vote" | "veto" | "buying" | "done" | "cancelled";

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
  counting: { a: -35, b: 20 },
  searching: { a: -100, b: -108 },
  ranking: { a: -40, b: -20 },
  vote: { a: -120, b: 30 },
  veto: { a: -22, b: -10 },
  buying: { a: -55, b: 45 },
  done: { a: 20, b: -40 },
  cancelled: { a: -130, b: 0 },
};

type Prop = "giftA" | "giftB" | "coin" | "card" | "camera" | "pan" | "candle" | "chocs" | "thumb0" | "thumb1" | "thumb2";
const GOLD = "#C9A27E";
/** A big, readable coin: ink disc, kraft-gold face, PayPal-blue ring (r 14 = 36px+ at 260px). */
function Coin({ cx, cy }: { cx: number; cy: number }) {
  return <g><circle cx={cx} cy={cy} r={14} fill={INK} stroke={PAYPAL_BLUES[1]} strokeWidth={3} /><circle cx={cx} cy={cy} r={9} fill={GOLD} /><path d={`M${cx} ${cy - 5} V${cy + 5}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" /></g>;
}
// Little things Kitty handles. Drawn in forearm space so they travel with the glove.
const PROPS: Partial<Record<Prop, React.ReactNode>> = {
  giftA: (<g><rect x={123} y={106} width={15} height={14} rx={1.5} fill={KRAFT} stroke={INK} strokeWidth={1.5} /><path d="M130.5 106 V120" stroke={PAYPAL_BLUES[1]} strokeWidth={2.4} /></g>),
  giftB: (<g><path d="M124 108 H136 V119 C136 121 124 121 124 119 Z" fill={PAPER} stroke={INK} strokeWidth={1.5} /><path d="M136 110 C140 110 140 116 136 116" fill="none" stroke={INK} strokeWidth={1.5} /></g>),
  coin: <Coin cx={131} cy={110} />,
  camera: (<g><rect x={122} y={108} width={18} height={12} rx={2} fill={INK} stroke={INK} strokeWidth={1.2} /><path d="M125 108 V105.5 H130 V108" fill={INK} /><path d="M131 110.5 A3.6 3.6 0 1 1 130.9 110.5 Z" fill={PAPER} stroke={INK} strokeWidth={1.2} /><path d="M136 110 H138.5" stroke={PAPER} strokeWidth={1.2} strokeLinecap="round" /></g>),
  pan: (<g><path d="M121 110 H139 V116 C139 120 121 120 121 116 Z" fill={INK} /><path d="M118 111 H121 M139 111 H142" stroke={INK} strokeWidth={2.4} strokeLinecap="round" /><path d="M120 108.5 C124 106 136 106 140 108.5" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" /><path d="M128 108 H132" stroke={PAPER} strokeWidth={1.2} strokeLinecap="round" /></g>),
  candle: (<g><path d="M124 109 H137 V120 C137 121.5 124 121.5 124 120 Z" fill={PAPER} stroke={INK} strokeWidth={1.5} /><path d="M124 112 H137" stroke={KRAFT_DEEP} strokeWidth={1.4} /><path d="M130.5 109 V106" stroke={INK} strokeWidth={1} /><path d="M130.5 99.5 C132.5 102 132.5 104.5 130.5 105.5 C128.5 104.5 128.5 102 130.5 99.5 Z" fill={PAYPAL_BLUES[1]} /></g>),
  chocs: (<g><rect x={121} y={109} width={19} height={11} rx={1.5} fill={INK} /><path d="M124 112.5 H127 M129 112.5 H132 M134 112.5 H137 M124 116.5 H127 M129 116.5 H132 M134 116.5 H137" stroke={KRAFT} strokeWidth={2.2} strokeLinecap="round" /><path d="M130.5 109 V106 M127.5 104.5 C129 106 130.5 106 130.5 106 C130.5 106 132 106 133.5 104.5" fill="none" stroke={PAYPAL_BLUES[1]} strokeWidth={1.4} strokeLinecap="round" /></g>),
  card: (<rect x={123} y={100} width={14} height={19} rx={2} fill={PAPER} stroke={INK} strokeWidth={1.6} />),
};

// Choreographed loops: shoulder (a) and elbow (b) keyframes with props shown/hidden on the same timeline.
type Act = { a: number[]; b: number[]; dur: number; times: number[]; head?: number[]; props?: { k: Prop; o: number[] }[]; hold?: boolean; once?: boolean };
// Browsing: for each item, reach into the box, lift it to the monocle, turn it over, then set it back down.
const BEAT = [0, 0.26, 0.48, 0.68, 0.96];
const BEAT_A = [12, -100, -94, -101, 12];
const BEAT_B = [12, -106, -112, -102, 12];
function browse(items: Prop[]): Act {
  const n = items.length;
  const times: number[] = [], a: number[] = [], b: number[] = [];
  for (let k = 0; k < n; k++) BEAT.forEach((f, j) => { times.push((k + f) / n); a.push(BEAT_A[j] ?? 12); b.push(BEAT_B[j] ?? 12); });
  times.push(1); a.push(12); b.push(12);
  // o[i] marks the interval starting at times[i]; the item rides in the glove from pick-up until it's set down.
  const props = items.map((it, k) => ({ k: it, o: times.map((_, i) => (Math.floor(i / BEAT.length) === k && i % BEAT.length < BEAT.length - 1 ? 1 : 0)) }));
  return { dur: n * 1.4, times, a, b, props, hold: true };
}
/** Head looks at whatever the glove is holding: tilts in while inspecting, back down to the box between items. */
function browseHead(act: Act) {
  return act.times.map((_, i) => { const j = i % BEAT.length; return i === act.times.length - 1 ? -2 : j === 2 ? -9 : j === 3 ? 4 : -2; });
}


const ACTS: Partial<Record<MascotState, Act>> = {
  // Count the takings: dip into the box, lift a coin to admire it, drop it back.
  idle: { dur: 8, times: [0, 0.55, 0.65, 0.75, 0.88, 1], a: [0, 0, 20, -45, -45, 0], b: [0, 0, 10, -60, -60, 0],
    props: [{ k: "coin", o: [0, 0, 0, 1, 1, 0] }] },
  // Dip, reach up and catch the coin arcing in, glance at it, drop it in the box, settle.
  chipIn: { dur: 1.6, once: true, hold: true, times: [0, 0.12, 0.3, 0.42, 0.55, 0.72, 0.84, 1],
    a: [12, 22, -95, -102, -84, 12, 20, 12], b: [12, 18, -95, -106, -92, 12, 16, 12], head: [0, 4, -8, -11, -6, 5, 1, 0],
    props: [{ k: "coin", o: [0, 0, 1, 1, 1, 0, 0, 0] }] },
  // Winner: dip, catch the gift flying in from its card, present it, lower it into the box.
  vote: { dur: 1.8, once: true, hold: true, times: [0, 0.14, 0.36, 0.48, 0.62, 0.8, 0.9, 1],
    a: [12, 22, -72, -80, -62, 12, 20, 12], b: [12, 16, -40, -50, -36, 12, 14, 12], head: [0, 3, -6, -9, -4, 6, 2, 0],
    props: [{ k: "thumb0", o: [0, 0, 1, 1, 1, 0, 0, 0] }] },
  // Three measured taps build a neat stack, then the surplus is pushed right.
  counting: { dur: 4.8, hold: true, times: [0, 0.08, 0.18, 0.25, 0.33, 0.43, 0.5, 0.58, 0.68, 0.75, 0.84, 0.92, 1],
    a: [12, -72, -35, 12, -72, -35, 12, -72, -35, -35, -60, -60, 12],
    b: [12, -80, 20, 12, -80, 20, 12, -80, 20, 20, 55, 55, 12],
    head: [0, -5, 3, 0, -5, 3, 0, -5, 3, 0, 0, 8, 0],
    props: [{ k: "coin", o: [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0] }] },
  // Pick a gift up, inspect it at eye level, put it down, pick up another.
  searching: browse(["camera", "pan", "candle", "chocs", "giftB"]),
  // Take the chosen gift, consider it once more, pack it into the box.
  ranking: { dur: 4.2, hold: true, times: [0, 0.12, 0.23, 0.33, 0.45, 0.56, 0.67, 0.79, 0.9, 1],
    a: [12, -100, -94, 12, -100, -94, 12, -96, 12, 12],
    b: [12, -106, -112, 12, -106, -112, 12, -106, 12, 12],
    head: [0, -8, 4, 0, -8, 4, 0, -4, 8, 0],
    props: [{ k: "giftA", o: [0, 1, 1, 0, 0, 0, 0, 0, 0, 0] }, { k: "giftB", o: [0, 0, 0, 0, 1, 1, 0, 1, 1, 0] }] },
  // Paw hovers, then two dainty taps on the bell.
  veto: { dur: 3, times: [0, 0.5, 0.6, 0.7, 0.8, 1], a: [-22, -22, -8, -22, -8, -22], b: [-10, -10, 4, -10, 4, -10] },
  // Wrapping: pull the ribbon down, loop it over, tug it tight.
  buying: { dur: 2, once: true, times: [0, 0.1, 0.4, 0.5, 0.6, 0.8, 1],
    a: [12, 20, -95, -40, 12, 12, 12], b: [12, 18, 45, 65, 12, 12, 12], head: [0, 0, -4, 0, 24, 24, 0] },
};

/** Where the glove is in view space for a shoulder (a) and elbow (b) angle, so flying items land in it. */
function rot(x: number, y: number, ox: number, oy: number, deg: number) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), n = Math.sin(r);
  return { x: ox + (x - ox) * c - (y - oy) * n, y: oy + (x - ox) * n + (y - oy) * c };
}
function glovePos(a: number, b: number) {
  const e = rot(131, 112, 124, 106, b);
  return rot(e.x, e.y, 112, 86, a);
}
/** Arc from a start point into the glove, with a little lift in the middle. */
function arcTo(from: { x: number; y: number }, to: { x: number; y: number }, u: number, lift = 46) {
  const e = u * u * (3 - 2 * u);
  return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * u) * lift };
}

function sample(values: number[], times: number[], phase: number) {
  let i = 0;
  while (i < times.length - 2 && (times[i + 1] ?? 1) <= phase) i++;
  const start = times[i] ?? 0, end = times[i + 1] ?? 1;
  const progress = Math.max(0, Math.min(1, (phase - start) / (end - start || 1)));
  const smooth = progress * progress * (3 - 2 * progress);
  return (values[i] ?? 0) + ((values[i + 1] ?? values[i] ?? 0) - (values[i] ?? 0)) * smooth;
}

const TAIL = {
  s1: "M66 160 C42 158 30 142 38 126 C46 110 34 94 20 92",
  s2: "M66 160 C44 164 24 150 32 132 C40 114 28 100 14 104",
  s3: "M66 160 C38 152 42 132 46 120 C52 102 42 88 30 80",
  low: "M66 160 C46 166 30 164 22 156 C14 148 16 140 22 136",
  high: "M66 160 C40 150 34 120 44 98 C52 80 46 66 34 60",
};

export function KittyMascot({ state = "idle", beat, fill = 0, size = 72, className, label, wink: forceWink = false, items, externalRelease = false }: { state?: MascotState; beat?: number; fill?: number; size?: number; className?: string | undefined; label?: string; wink?: boolean; items?: string[]; externalRelease?: boolean }) {
  return <KittyAction key={`${state}-${beat ?? "loop"}`} state={state} beat={beat} fill={fill} size={size} className={className} label={label} wink={forceWink} items={items} externalRelease={externalRelease} />;
}

function KittyAction({ state: s, beat, fill, size, className, label, wink: forceWink, items, externalRelease }: { state: MascotState; beat: number | undefined; fill: number; size: number; className: string | undefined; label: string | undefined; wink: boolean; items: string[] | undefined; externalRelease: boolean }) {
  const reduce = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const grad = `rb-${uid}`;
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
  const thumbs = items?.slice(0, 3) ?? [];
  const itemKey = thumbs.join("|");
  // With real gift photos, Kitty browses and chooses those thumbnails instead of drawn items.
  const act = useMemo<Act | undefined>(() => {
    if (reduce || ((s === "chipIn" || s === "vote") && !beat)) return undefined;
    if (s === "vote" && !thumbs.length) return undefined;
    if (s === "searching" && thumbs.length) { const b = browse(thumbs.map((_, i) => `thumb${i}` as Prop)); return { ...b, dur: thumbs.length * 1.6 }; }
    const base = ACTS[s];
    if (s === "ranking" && base && thumbs.length > 1 && base.props?.[0] && base.props?.[1]) return { ...base, props: [{ k: "thumb1", o: base.props[0].o }, { k: "thumb0", o: base.props[1].o }] };
    return base;
  }, [reduce, s, beat, itemKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Which held prop is visible, driven by a clock on the same timeline as the arm keyframes.
  const [phase, setPhase] = useState(0);
  const [clockMs, setClockMs] = useState(0);
  const shoulder = useSpring(act?.a[0] ?? arm.a, LIMB);
  const elbow = useSpring(act?.b[0] ?? arm.b, LIMB);
  const head = useSpring(0, SPRING);
  const tail = useSpring(0, { stiffness: 75, damping: 15, mass: 1.2 });
  const releasePoint = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!act) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const raw = (performance.now() - t0) / 1000 / act.dur;
      setClockMs((performance.now() - t0));
      const p = act.once && beat !== undefined ? Math.min(1, raw) : raw % 1;
      setPhase(p);
      shoulder.set(sample(act.a, act.times, p));
      elbow.set(sample(act.b, act.times, p));
      head.set(sample(act.head ?? (s === "searching" ? browseHead(act) : act.a.map(() => 0)), act.times, p));
      // Tail leads: it reads the pose slightly ahead of the arm.
      tail.set(sample(act.a, act.times, act.once ? Math.min(1, p + 0.05) : (p + 0.05) % 1) / 16);
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [act, beat, s, shoulder, elbow, head, tail]);
  const propOn = (o: number[]) => {
    if (!act) return false;
    let i = 0;
    while (i < act.times.length - 1 && (act.times[i + 1] ?? 1) <= phase) i++;
    if (act.hold) return o[i] === 1;
    return o[i] === 1 && (o[i + 1] ?? o[i]) === 1 ? true : o[i] === 1 && phase - (act.times[i] ?? 0) < ((act.times[i + 1] ?? 1) - (act.times[i] ?? 0)) / 2;
  };

  // Detach the object from the glove before it lowers, then render behind the box front.
  const actionMs = phase * (act?.dur ?? 0) * 1000;
  const dropStart = s === "chipIn" ? 700 : 1116;
  const dropping = !!act && (s === "chipIn" || s === "vote") && actionMs >= dropStart && actionMs < dropStart + 400;
  const dropU = Math.max(0, Math.min(1, (actionMs - dropStart) / 400));
  const dropPhase = dropStart / ((act?.dur ?? 1) * 1000);
  if (actionMs < dropStart) releasePoint.current = glovePos(shoulder.get(), elbow.get());
  const dropFrom = releasePoint.current ?? glovePos(act ? sample(act.a, act.times, dropPhase) : 0, act ? sample(act.b, act.times, dropPhase) : 0);
  const dropX = dropFrom.x + (109 - dropFrom.x) * dropU;
  const dropY = dropFrom.y - (s === "vote" ? 12 : 2) + (158 - dropFrom.y + (s === "vote" ? 12 : 2)) * dropU * dropU;
  const rimScale = !act || (s !== "chipIn" && s !== "vote") ? 1 : sample([1, 0.94, 1.04, 1], [0, 0.25, 0.6, 1], Math.max(0, Math.min(1, (actionMs - dropStart - 400) / 300)));
  const bowDrop = s === "buying" && !reduce ? sample([0, 0, 48, 48, 0], [0, 0.5, 0.6, 0.8, 1], phase) : 0;

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
            <filter id={`sh-${uid}`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#141210" floodOpacity="0.28" /></filter>
            {thumbs.map((_, i) => <clipPath key={i} id={`th-${uid}-${i}`}><rect x={110} y={79} width={42} height={42} rx={4} /></clipPath>)}
          </defs>

          {/* Tail leads the motion: it moves first, limbs follow a beat later. */}
          <motion.path d={TAIL.s1} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" style={{ rotate: tail, originX: "66px", originY: "160px", transformBox: "view-box" }}
            animate={{ d: tailD }}
            transition={Array.isArray(tailD) ? { duration: 5.5, repeat: Infinity, ease: SILK } : t({ duration: 0.9, ease: SILK })} />

          {/* The butler */}
          <g data-bowing={s === "buying" ? "true" : undefined} transform={`translate(0 ${bowDrop * 0.25})`}>
            {/* torso, breathing */}
            <motion.g style={{ originX: "98px", originY: "132px", transformBox: "view-box" }}
              animate={{ scaleY: s === "buying" ? 1 - bowDrop / 180 : s === "idle" ? R([1, 1.018, 1], 1) : s === "done" ? 0.94 : 1 }}
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
            <motion.g style={{ originX: "96px", originY: "70px", transformBox: "view-box", ...(act ? { rotate: head } : {}) }}
              animate={act ? { y: bowDrop * 0.75 } :
                s === "chipIn" ? { rotate: 6, y: 2 }
                : s === "done" ? R({ y: [0, 10, 10, 0], rotate: [0, 6, 6, 0] }, { y: 10, rotate: 6 })
                : s === "searching" && act ? { rotate: browseHead(act), y: 0 }
                : { rotate: s === "ranking" ? 9 : s === "veto" ? -5 : s === "searching" ? -3 : s === "cancelled" ? -4 : 0, y: s === "idle" ? R([0, -0.8, 0], 0) : 0 }
              }
              transition={s === "searching" && act ? { duration: act.dur, times: act.times, repeat: Infinity, ease: SILK } : s === "chipIn" ? loop(1.7, 0.35) : s === "done" ? loop(2.8, 0.15) : s === "idle" ? loop(4.2) : { ...SPRING, delay: 0.06 }}>
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
            <motion.g style={{ originX: "112px", originY: "86px", transformBox: "view-box", ...(act ? { rotate: shoulder } : {}) }}
              animate={act ? {} : { rotate: arm.a }}
              transition={t(LIMB)}>
              <path d="M112 86 L124 106" stroke={INK} strokeWidth={7} strokeLinecap="round" />
              <motion.g style={{ originX: "124px", originY: "106px", transformBox: "view-box", ...(act ? { rotate: elbow } : {}) }}
                animate={act ? {} : s === "cancelled" ? { rotate: R([-25, 20, -25], 0) } : { rotate: arm.b }}
                transition={s === "cancelled" ? loop(1.3) : t(LIMB)}>
                <path d="M124 106 L130 124" stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
                {/* props held in the glove */}
                {act?.props?.map((pr, i) => propOn(pr.o) && !((s === "chipIn" || s === "vote") && actionMs >= dropStart) ? <g key={`${s}-${i}`} data-held-item={pr.k} transform={`translate(131 115) rotate(${-shoulder.get() - elbow.get()}) scale(${pr.k === "coin" || pr.k.startsWith("thumb") ? 1 : 2.2}) translate(-131 -115)`}>{pr.k.startsWith("thumb") ? <Thumb href={thumbs[Number(pr.k.slice(5))] ?? ""} uid={uid} i={Number(pr.k.slice(5))} x={131} y={100} /> : PROPS[pr.k]}</g> : null)}
                {/* white glove */}
                <path d="M126 122 C126 118 134 118 135 122 C138 123 138 127 135 128.5 C134 132 127 132 126 128.5 C123.5 127 123.5 123.5 126 122 Z" fill={PAPER} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                <path d="M128.5 124.5 L132.5 124.5 M128 127 L133 127" stroke={INK} strokeWidth={0.9} strokeLinecap="round" opacity={0.6} />
                {/* ballot card presented with a flourish */}
                {s === "vote" && !act && (
                  <motion.g initial={{ opacity: 0, rotate: -30 }} animate={{ opacity: 1, rotate: 0 }} transition={t(SNAP)}
                    style={{ originX: "131px", originY: "122px", transformBox: "view-box" }}>
                    <path d="M126 96 H146 V120 H126 Z" fill={PAPER} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
                    <path d="M130.5 108 L135 112.5 L142 103" fill="none" stroke={PAYPAL_BLUES[1]} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                  </motion.g>
                )}
              </motion.g>
            </motion.g>
          </g>

          {/* Coins inside, peeking over the rim as the pot fills; they float out when cancelled */}
          {Array.from({ length: coins }).map((_, i) => (
            <motion.circle key={i} cx={74 + i * 14} cy={125} r={6} fill={KRAFT_DEEP} stroke={INK} strokeWidth={1.6}
              initial={{ y: 8 }} animate={{ y: s === "cancelled" ? R(-80 - i * 10, -18) : 0, opacity: s === "cancelled" ? R(0, 0.6) : 1 }}
              transition={s === "cancelled" ? t({ duration: 2, delay: i * 0.15, ease: SILK }) : SPRING} />
          ))}

          {s === "counting" && <g aria-hidden>
            {Array.from({ length: reduce ? 3 : Math.min(3, Math.floor(phase / 0.25)) }).map((_, i) => (
              <ellipse key={i} cx={150} cy={124 - i * 5} rx={12} ry={4.5} fill={GOLD} stroke={INK} strokeWidth={1.6} />
            ))}
          </g>}

          {dropping && <g data-box-drop={s} transform={`translate(${dropX} ${dropY}) scale(${1 - dropU * 0.24})`}>
            {s === "chipIn" ? <Coin cx={0} cy={0} /> : <Thumb href={thumbs[0] ?? ""} uid={uid} i={0} x={0} y={0} />}
          </g>}

          {/* Opaque box front occludes the falling object, rather than fading it away. */}
          <g>
            <rect x={58} y={128} width={102} height={54} rx={5} fill={KRAFT} stroke={INK} strokeWidth={2} />
            <path d="M58 138 L160 138" stroke={KRAFT_DEEP} strokeWidth={1.2} opacity={0.5} />
          </g>
          <g data-box-rim transform={`translate(109 132) scale(1 ${rimScale}) translate(-109 -132)`}>
            <rect x={56} y={126} width={106} height={9} rx={3} fill={KRAFT} stroke={INK} strokeWidth={2} />
          </g>
          <motion.rect x={102} y={128} width={14} height={54} fill={`url(#${grad})`}
            style={{ originX: "109px", originY: "128px", transformBox: "view-box" }}
            initial={false}
            animate={{ scaleY: ribbonOn ? (s === "buying" ? R([0, 1], 1) : 1) : 0, opacity: ribbonOn ? 1 : 0 }}
            transition={s === "buying" ? t({ duration: 0.6, ease: SILK, repeat: beat === undefined ? Infinity : 0, repeatDelay: 1.4 }) : t({ duration: 0.9, ease: SILK })} />

          {s === "buying" && <path d="M58 146 H160" stroke={`url(#${grad})`} strokeWidth={10} pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={reduce ? 0 : 1 - Math.max(0, Math.min(1, (actionMs - 200) / 600))} />}
          {s === "buying" && !reduce && actionMs >= 200 && actionMs < 1000 && (() => {
            const g = glovePos(shoulder.get(), elbow.get());
            return <path data-ribbon-pull d={`M109 128 Q${g.x - 20} ${g.y + 26} ${g.x} ${g.y}`} fill="none" stroke={`url(#${grad})`} strokeWidth={8} strokeLinecap="round" />;
          })()}

          {s === "counting" && !externalRelease && <g aria-hidden>
            {[0, 1, 2, 3].map((i) => {
              const start = 1050 + i * 150;
              const slide = reduce ? 1 : Math.max(0, Math.min(1, (actionMs - start) / 900));
              const ease = slide * slide * (3 - 2 * slide);
              return <g key={i} data-released-coin={i} transform={`translate(${ease * (160 + i * 15)} ${ease * (18 + i * 22)})`} opacity={reduce || actionMs >= start ? 1 : 0}><Coin cx={109} cy={124} /></g>;
            })}
          </g>}

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

          {/* Coin arcing in from the contributor card (chip-in) and the winning gift flying in (vote) */}
          {act && s === "chipIn" && phase < 0.3 && (() => { const g = glovePos(-95, -95); const c = arcTo({ x: 225, y: 30 }, g, phase / 0.3); return <Coin cx={c.x} cy={c.y} />; })()}
          {act && s === "vote" && phase < 0.36 && thumbs[0] && (() => { const g = glovePos(-72, -40); const c = arcTo({ x: 250, y: 70 }, { x: g.x, y: g.y - 12 }, phase / 0.36, 30); return <Thumb href={thumbs[0]} uid={uid} i={0} x={c.x} y={c.y} />; })()}
          {/* Bow: snaps tight when buying, bounces when done, unties when cancelled */}
          <motion.g style={{ originX: "109px", originY: "128px", transformBox: "view-box" }} initial={false}
            animate={
              s === "cancelled" ? { scale: R(0, 0.6), rotate: 50, opacity: R(0, 0.4) }
              : s === "buying" ? { scale: reduce ? 1 : sample([0, 0, 1.18, 1, 1], [0, 0.4, 0.46, 0.5, 1], phase), rotate: 0, opacity: 1 }
              : s === "done" ? { scale: 1.1, y: R([0, -7, 0], 0), rotate: 0, opacity: 1 }
              : { scale: 1, y: 0, rotate: 0, opacity: 1 }
            }
            transition={
              s === "buying" ? t(SNAP)
              : s === "done" ? { y: loop(1, 0.4), scale: SNAP }
              : t({ duration: 0.8, ease: SILK })
            }>
            <path d="M109 128 C94 112 82 120 88 130 C92 136 102 132 109 128 Z" fill={`url(#${grad})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            <path d="M109 128 C124 112 136 120 130 130 C126 136 116 132 109 128 Z" fill={`url(#${grad})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            <path d="M104.5 124.5 H113.5 V131.5 H104.5 Z" fill={`url(#${grad})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          </motion.g>

          {s === "done" && !reduce && <Suspense fallback={null}><Confetti colors={[...PAYPAL_BLUES, GOLD, "#141210"]} /></Suspense>}
          {s === "buying" && !reduce && <Suspense fallback={null}><Confetti once ms={clockMs - 900} colors={[...PAYPAL_BLUES, KRAFT, INK]} /></Suspense>}
        </motion.svg>
      </AnimatePresence>
    </span>
  );
}

/** A gift photo on a white card with a soft shadow, centred on (x, y); 50 units = 64px+ at 260px. */
function Thumb({ href, uid, i, x, y }: { href: string; uid: string; i: number; x: number; y: number }) {
  return (
    <g transform={`translate(${x - 131} ${y - 100})`}>
      <rect x={106} y={75} width={50} height={50} rx={6} fill={PAPER} stroke="#E8E2D9" strokeWidth={1} filter={`url(#sh-${uid})`} />
      <image href={href} x={110} y={79} width={42} height={42} preserveAspectRatio="xMidYMid slice" clipPath={`url(#th-${uid}-${i})`} />
    </g>
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
    counting: "stacking coins and sliding the released money back",
    searching: "browsing gifts: a camera, a pan, a candle, chocolates and a mug",
    ranking: "packing the chosen gift into the box",
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
