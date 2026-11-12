import { createFileRoute, Link } from "@tanstack/react-router";
import { DemoStage } from "@/components/kitty/DemoStage";
import { getDemoPicks } from "@/lib/kitty.functions";
import { DEMO_HOME_PICKS } from "@/lib/demoPicks";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Watch Kitty buy Priya's gift: the 80-second demo" },
      { name: "description", content: "Nine colleagues chip in with PayPal holds, Kitty shops real gifts, the group votes, and everyone pays only their share." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Watch Kitty buy Priya's gift" },
      { property: "og:description", content: "An 80-second story from chip-in to wrapped gift, with the surplus released in proportion." },
    ],
  }),
  // One quick read of real saved Channel3 gifts; anything goes wrong and the stage uses the saved homepage three.
  loader: async () => {
    try {
      const picks = await getDemoPicks();
      return { picks: picks.length === 3 ? picks : DEMO_HOME_PICKS };
    } catch {
      return { picks: DEMO_HOME_PICKS };
    }
  },
  staleTime: 5 * 60_000,
  component: DemoPage,
  errorComponent: () => <DemoStage picks={DEMO_HOME_PICKS} />,
  notFoundComponent: () => <div className="p-10 text-center"><Link to="/">Back to Kitty</Link></div>,
});

function DemoPage() {
  const { picks } = Route.useLoaderData();
  return <DemoStage picks={picks} />;
}
