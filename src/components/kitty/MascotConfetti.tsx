import { motion } from "motion/react";

/** Celebration confetti for the mascot's done state. Split out so other states don't load it. */
export default function MascotConfetti({ ribbon, kraft }: { ribbon: string; kraft: string }) {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.rect key={i} x={98} y={100} width={5} height={8} rx={1} fill={i % 2 ? ribbon : kraft}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
            animate={{ x: Math.cos(a) * 70, y: Math.sin(a) * 50 - 30, opacity: [0, 1, 0], rotate: 180 }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeOut" }} />
        );
      })}
    </>
  );
}
