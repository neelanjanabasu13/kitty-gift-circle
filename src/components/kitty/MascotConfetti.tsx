import { motion } from "motion/react";

/** Celebration confetti: 44 pieces in PayPal blues, kraft and ink, about 2s per burst. Split out so other states don't load it. */
export default function MascotConfetti({ colors, once = false }: { colors: string[]; once?: boolean }) {
  const N = 44;
  return (
    <>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2 + (i % 3) * 0.2;
        const r = 70 + (i % 5) * 14;
        return (
          <motion.rect key={i} x={106} y={110} width={i % 2 ? 5 : 4} height={i % 2 ? 9 : 7} rx={1} fill={colors[i % colors.length]}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
            animate={{ x: [0, Math.cos(a) * r, Math.cos(a) * r * 1.1], y: [0, Math.sin(a) * r * 0.7 - 40, Math.sin(a) * r * 0.7 + 20], opacity: [0, 1, 1, 0], rotate: 260 + (i % 4) * 60 }}
            transition={{ duration: 2, times: [0, 0.4, 1], ease: [0.22, 1, 0.36, 1], ...(once ? {} : { repeat: Infinity, repeatDelay: 1.6 }) }} />
        );
      })}
    </>
  );
}
