import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/** Seeded variation avoids hydration differences while giving every piece its own ballistic flight. */
export default function MascotConfetti({ colors, once = false, ms }: { colors: string[]; once?: boolean; ms?: number }) {
  const reduce = useReducedMotion();
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (ms !== undefined || reduce) return;
    const start = performance.now();
    let id: number;
    const frame = (now: number) => { setClock(now - start); id = requestAnimationFrame(frame); };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [ms, reduce]);
  const elapsed = ms ?? (once ? clock : clock % 4100);
  if (reduce || elapsed < 0 || elapsed >= 2500) return null;
  const seconds = elapsed / 1000;
  const random = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
  return <g data-wrapping-confetti aria-hidden>{Array.from({ length: 48 }, (_, i) => {
    const x = 109 + (random(i, 1) - 0.5) * 260 * seconds;
    const y = 128 - (95 + random(i, 2) * 115) * seconds + 100 * seconds * seconds;
    const strip = i % 3 === 0;
    const width = strip ? 2.5 : 6 + random(i, 3) * 4;
    const height = strip ? 11 : 6 + random(i, 4) * 4;
    const rotation = random(i, 5) * 80 + (random(i, 6) - 0.5) * 540 * seconds;
    return <rect key={i} data-confetti-shape={strip ? "strip" : "rect"} x={x - width / 2} y={y - height / 2} width={width} height={height} rx={0.7} fill={colors[i % colors.length]} opacity={Math.min(1, (2500 - elapsed) / 400)} transform={`rotate(${rotation} ${x} ${y})`} />;
  })}</g>;
}
