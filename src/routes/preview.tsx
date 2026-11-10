import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/kitty/Logo";
import { Cancelled, FinalVote, Receipt, VetoCountdown } from "@/components/kitty/Stages";

// Hidden style sheet for the later-phase screens, filled with sample data.
export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [
      { title: "Screens preview · Kitty" },
      { name: "description", content: "Preview of Kitty's vote, veto, receipt and cancelled screens." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Screens preview · Kitty" },
      { property: "og:description", content: "Preview of Kitty's later screens." },
    ],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const [left, setLeft] = useState(18 * 60 + 42);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 30 * 60)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-24 px-5 py-12">
        <p className="font-mono text-[12px] text-muted-foreground">Sample screens with example data</p>
        <FinalVote
          currency="GBP"
          closesLine="Closes at 3pm or when everyone who wants to vote has voted."
          picks={[
            { id: "a", title: "Le Creuset round casserole", price: 118, votes: 5 },
            { id: "b", title: "Pasta-making class for two", price: 95, votes: 3 },
            { id: "c", title: "Hand-thrown pour-over set", price: 64, votes: 1 },
          ]}
        />
        <VetoCountdown title="Le Creuset" price={118} currency="GBP" at="5pm" why="She cooks every Sunday and the group voted cooking first." secondsLeft={left} totalSeconds={30 * 60} />
        <Receipt
          recipient="Priya" item="Le Creuset round casserole, 22cm" retailer="John Lewis" currency="GBP" total={118} released={4}
          captureId="3C512345AB678901X" payoutId="PB-7K2LMN4QZ9"
          contributions={[{ name: "Sam", amount: 15 }, { name: "Jo", amount: 15 }, { name: "Ravi", amount: 12 }]}
          notes={[{ name: "Sam", message: "Go and cook something brilliant. We'll miss you." }, { name: "Jo", message: "Sunday lunches will never be the same." }]}
        />
        <Cancelled />
      </main>
    </div>
  );
}
