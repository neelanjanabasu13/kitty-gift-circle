import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/kitty/Logo";
import { Missing } from "@/components/kitty/Missing";
import { CardNotes } from "@/components/kitty/Stages";
import { potQuery, useLivePot } from "@/components/kitty/usePot";

export const Route = createFileRoute("/k/$slug_/card")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(potQuery(params.slug)),
  head: ({ loaderData }) => {
    const name = loaderData?.pot.recipient_name;
    const title = name ? `A card for ${name} · Kitty` : "A card from the group · Kitty";
    const desc = "Messages from everyone who chipped in for the gift.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: CardPage,
});

function CardPage() {
  const { slug } = Route.useParams();
  const { data } = useLivePot(slug);
  if (!data) return <Missing />;
  const { pot, signatures, people } = data;
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-10 px-5 pt-10 pb-20">
        <div className="space-y-3 text-center">
          <h1 className="text-[48px] md:text-[64px]">For <em>{pot.recipient_name}</em>, with love.</h1>
          <p className="text-[16px] text-muted-foreground">From {people} {people === 1 ? "person" : "people"}, organised by {pot.organiser_name}.</p>
        </div>
        {signatures.length ? (
          <CardNotes notes={signatures.map((s) => ({ key: s.id, name: s.name, message: s.message }))} />
        ) : (
          <p className="text-center text-[15px] text-muted-foreground">Nobody's written a message yet. They'll appear here as people sign.</p>
        )}
      </main>
    </div>
  );
}
