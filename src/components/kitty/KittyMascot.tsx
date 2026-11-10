import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lazy, Suspense } from "react";
const Confetti = lazy(() => import("./MascotConfetti"));

// Kitty: a simple geometric cat living in a kraft gift box with a red ribbon. Inline SVG, motion/react only.

export type MascotState = "idle" | "chipIn" | "searching" | "ranking" | "vote" | "veto" | "buying" | "done" | "cancelled";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 20 };
const SNAP = { type: "spring" as const, stiffness: 520, damping: 11 };
const INK = "var(--foreground)";
const KRAFT = "var(--kraft)";
const KRAFT_DEEP = "var(--kraft-deep)";
const RIBBON = "var(--ribbon)";
const PAPER = "var(--card)";

export function KittyMascot({ state = "idle", fill = 0, size = 72, className, label, wink: forceWink = false }: { state?: MascotState; fill?: number; size?: number; className?: string | undefined; label?: string; wink?: boolean }) {
  const reduce = !!useReducedMotion();
  const clip = useId().replace(/:/g, "");
  const blinking = useBlink(!reduce && state !== "buying");
  const s = state;

  const catY = s === "searching" ? -16 : s === "buying" ? 70 : s === "done" ? 26 : s === "vote" ? -6 : 0;
  const closed = s === "buying" || s === "done";
  const wink = s === "done" || forceWink;
  const look = s === "veto" ? { x: 2.5, y: 2.5 } : { x: 0, y: 0 };
  const coins = Math.max(0, Math.min(5, Math.round(Math.max(0, Math.min(1, fill)) * 5)));
  const loop = (v: number[], d: number, delay = 0) => (reduce ? { duration: 0 } : { duration: d, repeat: Infinity, ease: "easeInOut" as const, delay });

  return (
    <span className={className} style={{ display: "inline-block", width: size, height: size }} role="img" aria-label={label ?? `Kitty, ${describe(s)}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={reduce ? s : "live"}
          viewBox="0 0 200 200"
          width={size}
          height={size}
          initial={reduce ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 0 } : {}}
          transition={{ duration: 0.25 }}
          style={{ overflow: "visible" }}
        >
          <defs>
            <clipPath id={`c-${clip}`}>
              <rect x="0" y="-40" width="200" height="218" />
            </clipPath>
          </defs>

          {/* Shuffling product cards (ranking) */}
          {s === "ranking" && !reduce && [0, 1, 2].map((i) => (
            <motion.rect
              key={i}
              y={18}
              width={22}
              height={28}
              rx={4}
              fill={PAPER}
              stroke={INK}
              strokeWidth={2}
              initial={{ x: 50 + i * 38 }}
              animate={{ x: [50 + i * 38, 50 + ((i + 1) % 3) * 38, 50 + ((i + 2) % 3) * 38, 50 + i * 38] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
            />
          ))}
          {s === "ranking" && reduce && [0, 1, 2].map((i) => <rect key={i} x={50 + i * 38} y={18} width={22} height={28} rx={4} fill={PAPER} stroke={INK} strokeWidth={2} />)}

          {/* Flaps (behind the cat when open) */}
          <motion.rect x={40} y={56} width={9} height={54} rx={3} fill={KRAFT} stroke={INK} strokeWidth={2}
            style={{ originX: "40px", originY: "110px", transformBox: "view-box" }}
            animate={{ rotate: closed ? (s === "done" ? 60 : 90) : -28 }} transition={closed ? SPRING : SPRING} />
          <motion.rect x={151} y={56} width={9} height={54} rx={3} fill={KRAFT} stroke={INK} strokeWidth={2}
            style={{ originX: "160px", originY: "110px", transformBox: "view-box" }}
            animate={{ rotate: closed ? (s === "done" ? -60 : -90) : 28 }} transition={SPRING} />

          {/* Coins inside, peeking over the rim as the pot fills */}
          {Array.from({ length: coins }).map((_, i) => (
            <motion.circle key={i} cx={58 + i * 21} cy={110} r={7} fill={KRAFT_DEEP} stroke={INK} strokeWidth={2}
              initial={{ y: 8 }} animate={{ y: s === "cancelled" ? -90 - i * 8 : 0, opacity: s === "cancelled" ? 0 : 1 }}
              transition={s === "cancelled" ? { duration: 1.6, delay: i * 0.12, ease: "easeOut" } : SPRING} />
          ))}

          {/* The cat */}
          <g clipPath={`url(#c-${clip})`}>
            <motion.g animate={{ y: catY }} transition={s === "buying" ? { ...SPRING, stiffness: 260 } : SPRING}>
              <motion.g
                style={{ originX: "100px", originY: "120px", transformBox: "view-box" }}
                animate={{ rotate: s === "ranking" ? 9 : s === "veto" ? -4 : 0, scaleY: s === "idle" && !reduce ? [1, 1.025, 1] : 1 }}
                transition={s === "idle" && !reduce ? { scaleY: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }, rotate: SPRING } : SPRING}
              >
                {/* body */}
                <path d="M66 150 C66 118 80 104 100 104 C120 104 134 118 134 150 Z" fill={PAPER} stroke={INK} strokeWidth={2} />
                {/* ears */}
                <motion.path d="M72 74 L76 38 L98 60 Z" fill={PAPER} stroke={INK} strokeWidth={2} strokeLinejoin="round"
                  style={{ originX: "86px", originY: "66px", transformBox: "view-box" }}
                  animate={{ rotate: s === "chipIn" ? -8 : s === "cancelled" ? 12 : 0, scaleY: s === "chipIn" ? 1.12 : 1 }} transition={SPRING} />
                <motion.path d="M128 74 L124 38 L102 60 Z" fill={PAPER} stroke={INK} strokeWidth={2} strokeLinejoin="round"
                  style={{ originX: "114px", originY: "66px", transformBox: "view-box" }}
                  animate={{ rotate: s === "chipIn" ? 8 : s === "cancelled" ? -12 : 0, scaleY: s === "chipIn" ? 1.12 : 1 }} transition={SPRING} />
                <path d="M79 50 L82 62 L90 58 Z M121 50 L118 62 L110 58 Z" fill={RIBBON} opacity={0.35} />
                {/* head */}
                <ellipse cx={100} cy={84} rx={36} ry={31} fill={PAPER} stroke={INK} strokeWidth={2} />
                {/* eyes */}
                <Eye cx={86} cy={82} closed={blinking || false} look={look} scan={s === "searching" && !reduce} />
                <Eye cx={114} cy={82} closed={blinking || wink} look={look} scan={s === "searching" && !reduce} />
                {/* nose, mouth, whiskers */}
                <path d="M97 94 L103 94 L100 97.5 Z" fill={RIBBON} />
                <path d="M100 97.5 C100 101 96 102 94 100 M100 97.5 C100 101 104 102 106 100" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
                <path d="M70 92 L58 89 M70 97 L58 99 M130 92 L142 89 M130 97 L142 99" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
              </motion.g>
            </motion.g>
          </g>

          {/* Tail flicking over the box edge */}
          <motion.path
            d="M156 150 C176 146 182 128 172 116 C168 111 162 114 166 120"
            fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round"
            style={{ originX: "156px", originY: "150px", transformBox: "view-box" }}
            animate={{ rotate: s === "buying" || s === "done" ? -40 : reduce ? 0 : [0, -12, 0, 6, 0], opacity: s === "buying" ? 0 : 1 }}
            transition={s === "buying" || s === "done" ? SPRING : loop([0], 3.6)}
          />
          <motion.path
            d="M156 150 C176 146 182 128 172 116 C168 111 162 114 166 120"
            fill="none" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round"
            style={{ originX: "156px", originY: "150px", transformBox: "view-box" }}
            animate={{ rotate: s === "buying" || s === "done" ? -40 : reduce ? 0 : [0, -12, 0, 6, 0], opacity: s === "buying" ? 0 : 1 }}
            transition={s === "buying" || s === "done" ? SPRING : loop([0], 3.6)}
          />

          {/* Box front */}
          <rect x={40} y={110} width={120} height={70} rx={6} fill={KRAFT} stroke={INK} strokeWidth={2} />
          <path d="M40 122 L160 122" stroke={KRAFT_DEEP} strokeWidth={1.5} opacity={0.6} />
          {/* Ribbon band */}
          <motion.rect x={93} y={110} width={14} height={70} fill={RIBBON} stroke={INK} strokeWidth={2}
            style={{ originX: "100px", originY: "110px", transformBox: "view-box" }}
            animate={{ scaleY: s === "cancelled" ? 0 : 1, opacity: s === "cancelled" ? 0 : 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />

          {/* Paws on the rim (and props) */}
          <motion.g animate={{ opacity: s === "buying" ? 0 : 1, y: s === "done" ? 4 : 0 }} transition={SPRING}>
            <ellipse cx={78} cy={111} rx={10} ry={6} fill={PAPER} stroke={INK} strokeWidth={2} />
            <motion.g
              style={{ originX: "122px", originY: "111px", transformBox: "view-box" }}
              animate={
                s === "cancelled" && !reduce ? { rotate: [0, -30, -10, -30, 0], y: -24 }
                : s === "vote" ? { y: -34, rotate: 0 }
                : s === "veto" ? { y: -8, x: 18, rotate: 0 }
                : s === "ranking" && !reduce ? { y: [0, -6, 0], rotate: 0 }
                : s === "searching" ? { y: -20, rotate: 0 }
                : { y: 0, x: 0, rotate: 0 }
              }
              transition={s === "cancelled" ? { duration: 1.4, repeat: reduce ? 0 : Infinity } : s === "ranking" ? { duration: 0.5, repeat: Infinity, repeatDelay: 0.3 } : SPRING}
            >
              <ellipse cx={122} cy={111} rx={10} ry={6} fill={PAPER} stroke={INK} strokeWidth={2} />
              {s === "vote" && (
                <g>
                  <rect x={112} y={70} width={26} height={32} rx={3} fill={PAPER} stroke={INK} strokeWidth={2} />
                  <path d="M118 86 L124 92 L133 79" fill="none" stroke={RIBBON} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}
              {s === "searching" && (
                <g>
                  <circle cx={140} cy={92} r={11} fill={PAPER} fillOpacity={0.6} stroke={INK} strokeWidth={2.5} />
                  <path d="M132 100 L124 108" stroke={INK} strokeWidth={4} strokeLinecap="round" />
                </g>
              )}
            </motion.g>
          </motion.g>

          {/* Veto button */}
          <AnimatePresence>
            {s === "veto" && (
              <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
                <rect x={128} y={112} width={30} height={10} rx={3} fill={PAPER} stroke={INK} strokeWidth={2} />
                <motion.ellipse cx={143} cy={112} rx={9} ry={5} fill={RIBBON} stroke={INK} strokeWidth={2} animate={reduce ? {} : { y: [0, 1.5, 0] }} transition={loop([0], 1.4)} />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Coin dropping in (chip-in) */}
          <AnimatePresence>
            {s === "chipIn" && (
              <motion.g key="coin" initial={{ y: -120, opacity: 0 }} animate={{ y: reduce ? 0 : [-120, 0, -10, 0], opacity: [0, 1, 1, 0] }} transition={{ duration: 1.1, times: [0, 0.55, 0.75, 1], ease: "easeOut", repeat: reduce ? 0 : Infinity, repeatDelay: 0.6 }}>
                <circle cx={60} cy={104} r={9} fill={KRAFT_DEEP} stroke={INK} strokeWidth={2} />
                <path d="M60 99 L60 109" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Bow ties itself when buying, bounces when done */}
          <motion.g
            style={{ originX: "100px", originY: "112px", transformBox: "view-box" }}
            initial={false}
            animate={{
              scale: s === "cancelled" ? 0 : closed ? 1.25 : 0.85,
              rotate: s === "cancelled" ? 40 : 0,
              y: s === "done" && !reduce ? [0, -6, 0] : 0,
            }}
            transition={s === "done" && !reduce ? { y: { duration: 0.9, repeat: Infinity, repeatDelay: 1.2 }, scale: SNAP } : closed ? SNAP : SPRING}
          >
            <path d="M100 112 C84 96 74 104 80 114 C84 120 94 116 100 112 Z" fill={RIBBON} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <path d="M100 112 C116 96 126 104 120 114 C116 120 106 116 100 112 Z" fill={RIBBON} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={100} cy={112} r={5} fill={RIBBON} stroke={INK} strokeWidth={2} />
          </motion.g>

          {/* Confetti: only the done state needs it, so it loads on demand. */}
          {s === "done" && !reduce && <Suspense fallback={null}><Confetti ribbon={RIBBON} kraft={KRAFT} /></Suspense>}
        </motion.svg>
      </AnimatePresence>
    </span>
  );
}

function Eye({ cx, cy, closed, look, scan }: { cx: number; cy: number; closed: boolean; look: { x: number; y: number }; scan: boolean }) {
  return (
    <g>
      <motion.ellipse cx={cx} cy={cy} rx={8.5} ry={10} fill={INK} style={{ originX: `${cx}px`, originY: `${cy}px`, transformBox: "view-box" }} animate={{ scaleY: closed ? 0.1 : 1 }} transition={{ duration: 0.09 }} />
      {!closed && (
        <motion.circle cx={cx + 2.5} cy={cy - 3.5} r={3} fill={PAPER}
          animate={scan ? { x: [-4, 3, -4] } : { x: look.x, y: look.y }}
          transition={scan ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : SPRING} />
      )}
    </g>
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
        t = setTimeout(() => { setB(false); next(); }, 140);
      }, 3000 + Math.random() * 2000);
    };
    next();
    return () => clearTimeout(t);
  }, [on]);
  return b;
}

function describe(s: MascotState) {
  return {
    idle: "relaxing in the gift box",
    chipIn: "catching a coin",
    searching: "searching the shops",
    ranking: "sorting the picks",
    vote: "holding up a ballot",
    veto: "waiting by the veto button",
    buying: "wrapping up the gift",
    done: "winking from the wrapped gift",
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
