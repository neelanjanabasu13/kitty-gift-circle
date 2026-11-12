import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/kitty/DemoStage";
import { DEMO_HOME_PICKS, DEMO_IMAGES } from "@/lib/demoPicks";

// No loader and no server calls: the whole story and its gift photos ship with the page.
export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Watch Kitty buy Priya's gift: the one-minute demo" },
      { name: "description", content: "Nine colleagues chip in with PayPal holds, Kitty shops real gifts, the group votes, and everyone pays only their share." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Watch Kitty buy Priya's gift" },
      { property: "og:description", content: "A one-minute story from chip-in to wrapped gift, with the surplus released in proportion." },
    ],
    links: DEMO_IMAGES.map((href) => ({ rel: "preload", as: "image", href, type: "image/webp" })),
  }),
  component: () => <DemoStage picks={DEMO_HOME_PICKS} />,
});
