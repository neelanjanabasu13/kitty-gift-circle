/** Client-side timeline for the /demo stage. Pure data and maths, no I/O; the split reuses the live closing rules. */
import { DEMO_CAST, DEMO_TOTAL } from "./demoScript";
import { splitLines } from "./closing";
import type { DemoPick } from "./demoPicks";

export type DemoAct = "setup" | "chip" | "shop" | "vote" | "split" | "wrapped";
export const DEMO_ACTS: { id: DemoAct; label: string }[] = [
  { id: "setup", label: "Set up" },
  { id: "chip", label: "Chip in" },
  { id: "shop", label: "Shop" },
  { id: "vote", label: "Vote" },
  { id: "split", label: "Split" },
  { id: "wrapped", label: "Wrapped" },
];

export type SceneId = "setup" | "chip" | "shop50" | "shop100" | "vote" | "veto" | "bars" | "rows" | "ribbon" | "card" | "receipt";
export type Scene = { id: SceneId; act: DemoAct; ms: number; caption: string };

export const CHIP_LEAD_MS = 200;
export const CHIP_GAP_MS = 1200;

export const SETUP_MS = 7500;
/** Setup beats (ms into the setup scene): name typed, Ceramics tapped, pot created, first ideas shown. */
export const SETUP_BEATS = { name: 300, like: 2000, create: 3300, ideas: 4100 };

export const SCENES: Scene[] = [
  { id: "setup", act: "setup", ms: SETUP_MS, caption: "The organiser makes a pot for Priya and taps one like." },
  { id: "chip", act: "chip", ms: CHIP_LEAD_MS + DEMO_CAST.length * CHIP_GAP_MS + 400, caption: "Everyone chips in with a hold, not a charge." },
  { id: "shop50", act: "shop", ms: 7000, caption: "At £50, Kitty browses real shops for Priya." },
  { id: "shop100", act: "shop", ms: 6000, caption: "At £100 he reshuffles. Bigger gifts unlock." },
  { id: "vote", act: "vote", ms: 8800, caption: "Six of nine vote. Every penny still counts." },
  { id: "veto", act: "vote", ms: 5000, caption: "Last chance to swap or veto. Then he buys." },
  { id: "bars", act: "split", ms: 4000, caption: "The gift costs less than the pot holds." },
  { id: "rows", act: "split", ms: 7000, caption: "You're only charged your share. The rest is released." },
  { id: "ribbon", act: "wrapped", ms: 3800, caption: "Tied with a ribbon and ready to give." },
  { id: "card", act: "wrapped", ms: 6000, caption: "Everyone's messages, signed into one card." },
  { id: "receipt", act: "wrapped", ms: 4000, caption: "Paid by PayPal. Nobody fronted a penny." },
];

export const DEMO_TOTAL_MS = SCENES.reduce((s, x) => s + x.ms, 0);

/** Which scene is playing at `elapsed`, its index, start time and local time. Past the end returns null. */
export function sceneAt(elapsed: number) {
  let start = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i]!;
    if (elapsed < start + s.ms) return { scene: s, index: i, start, t: Math.max(0, elapsed - start) };
    start += s.ms;
  }
  return null;
}

export function sceneStart(index: number) {
  return SCENES.slice(0, index).reduce((s, x) => s + x.ms, 0);
}

export const DEMO_BOW_SNAP_MS = sceneStart(SCENES.findIndex((s) => s.id === "ribbon")) + 900;

/** Confetti belongs to the bow cue, never to the thank-you or receipt scenes. */
export function demoConfettiCue(elapsed: number, fired: boolean) {
  return !fired && elapsed >= DEMO_BOW_SNAP_MS && sceneAt(elapsed)?.scene.id === "ribbon"
    ? DEMO_BOW_SNAP_MS : null;
}

/** Running pot total after each chip-in. */
export const RUNNING = DEMO_CAST.reduce<number[]>((acc, p) => [...acc, (acc.at(-1) ?? 0) + p.amount], []);
/** Pot after the chip-ins that triggered the £50 and £100 searches. */
export const POT_AT_50 = RUNNING.find((r) => r >= 50)!;
export const POT_AT_100 = RUNNING.find((r) => r >= 100)!;

/** Final ranking for the demo: picks within the pot, priciest first, so the winner leaves a surplus to release. */
export function finalOrder(picks: DemoPick[]) {
  return picks.filter((p) => p.price <= DEMO_TOTAL).sort((a, b) => b.price - a.price).slice(0, 3);
}
/** Order shown when the pot first crosses £50: cheapest first. */
export function orderAt50(picks: DemoPick[]) {
  return [...finalOrder(picks)].sort((a, b) => a.price - b.price);
}
/** Order after the £100 search: in-reach gifts first (priciest first), then the ones still to unlock. */
export function orderAt100(picks: DemoPick[]) {
  const f = finalOrder(picks);
  return [...f.filter((p) => p.price <= POT_AT_100), ...f.filter((p) => p.price > POT_AT_100)];
}
export function nextUnlock(picks: DemoPick[], pot = POT_AT_100) {
  const locked = finalOrder(picks).filter((p) => p.price > pot).sort((a, b) => a.price - b.price)[0];
  return locked ? { pick: locked, more: Math.round((locked.price - pot) * 100) / 100 } : null;
}

/** Votes per final pick: vote 0 goes to the top pick, vote 1 to the second. */
export function voteTally() {
  const t = [0, 0, 0];
  for (const p of DEMO_CAST) if (p.vote !== undefined) t[p.vote]! += 1;
  return t;
}

/** Per-person held, paid and released for the winning gift, using the live surplus rule. */
export function demoSplit(price: number) {
  const lines = splitLines(DEMO_CAST.map((p, i) => ({ id: String(i), amount: p.amount })), price);
  return lines.map((l, i) => ({ ...l, person: DEMO_CAST[i]! }));
}
