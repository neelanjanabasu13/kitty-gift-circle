import { motion } from "motion/react";

/** Celebration confetti for the mascot's done state. Split out so other states don't load it. */
export default function MascotConfetti({ colors }: { colors: string[] }) {
  return (
    <>
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <motion.rect key={i} x={106} y={110} width={4} height={7} rx={1} fill={colors[i % colors.length]}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
            animate={{ x: Math.cos(a) * 72, y: Math.sin(a) * 48 - 34, opacity: [0, 1, 0], rotate: 200 }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.8, ease: [0.22, 1, 0.36, 1] }} />
        );
      })}
    </>
  );
}
