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
          name="Priya"
          currency="GBP"
          closesLine="Closes at 3pm or when everyone who wants to vote has voted."
          picks={[
            { id: "a", title: "Le Creuset round casserole", price: 118, votes: 5 },
            { id: "b", title: "Pasta-making class for two", price: 95, votes: 3 },
            { id: "c", title: "Hand-thrown pour-over set", price: 64, votes: 1 },
          ]}
        />
        <VetoCountdown title="Le Creuset" price={118} currency="GBP" at="5pm" why="She cooks every Sunday and the group voted cooking first." secondsLeft={left} totalSeconds={30 * 60} contributorLine="Kitty buys at 5pm. Your £10 is still only held." />
        <Receipt
          recipient="Priya" item="Le Creuset round casserole, 22cm" retailer="John Lewis" currency="GBP" price={118} held={122} released={4}
          payoutId="PB-7K2LMN4QZ9"
          payments={[{ key: "1", name: "Sam", amount: 14.51, captureId: "3C512345AB678901X" }, { key: "2", name: "Jo", amount: 14.51, captureId: "8H012345CD678901Y" }, { key: "3", name: null, amount: 11.61, captureId: "1J912345EF678901Z" }]}
          notes={[{ key: "a", name: "Sam", message: "Go and cook something brilliant. We'll miss you." }, { key: "b", name: "Jo", message: "Sunday lunches will never be the same." }]}
        />
        <Cancelled />
      </main>
    </div>
  );
}
