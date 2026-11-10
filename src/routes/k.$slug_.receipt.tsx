import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/kitty/Logo";
import { Missing } from "@/components/kitty/Missing";
import { Cancelled, Receipt } from "@/components/kitty/Stages";
import { potQuery, useLivePot } from "@/components/kitty/usePot";
import { Button } from "@/components/ui/button";
import { KittyMascot } from "@/components/kitty/KittyMascot";
import { useMine } from "@/components/kitty/Closing";

export const Route = createFileRoute("/k/$slug_/receipt")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(potQuery(params.slug)),
  head: ({ loaderData }) => {
    const name = loaderData?.pot.recipient_name;
    const title = name ? `${name}'s gift receipt · Kitty` : "Gift receipt · Kitty";
    const desc = "Paid for by the group through PayPal. Nobody fronted a penny.";
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
  component: ReceiptPage,
});

function ReceiptPage() {
  const { slug } = Route.useParams();
  const { data } = useLivePot(slug);
  const { mine, mySplit } = useMine(slug);
  if (!data) return <Missing />;
  const { pot, receipt } = data;
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-10 px-5 pt-8 pb-20">
        {pot.status === "cancelled" ? (
          <Cancelled />
        ) : pot.status !== "done" || !receipt?.gift ? (
          <section className="space-y-4 py-10 text-center">
            <h1 className="text-[44px]">Not paid for <em>yet.</em></h1>
            <p className="text-[16px] text-muted-foreground">The receipt appears here the moment Kitty buys the gift. Until then, every contribution is only held.</p>
            <Button asChild variant="quiet" size="xl"><Link to="/k/$slug" params={{ slug }}>Back to the kitty</Link></Button>
          </section>
        ) : (
          <>
            <KittyMascot state="done" size={240} className="mx-auto block" />
            <h1 className="text-center text-[44px] md:text-[56px]">Done. {pot.recipient_name}'s gift is paid for, <em>and nobody fronted a penny.</em></h1>
            <Receipt
              recipient={pot.recipient_name}
              item={receipt.gift.title}
              retailer={receipt.gift.retailer}
              currency={pot.currency}
              price={receipt.paid || receipt.gift.price}
              held={receipt.held}
              released={receipt.released}
              split={data.split?.lines ?? []}
              mineId={mine?.contributionId}
              mine={mySplit}
              details={[
                ...receipt.payments.map((p) => ({ label: `Capture${p.name ? `, ${p.name}` : ""}`, value: p.capture_id })),
                { label: "Payout batch", value: receipt.payout?.status === "fallback" ? null : receipt.payout?.batch_id },
                { label: "Payout item", value: receipt.payout?.item_id },
              ]}
              payoutLine={receipt.payout?.status === "fallback" ? `Would pay out to ${pot.organiser_name} in production. Captured funds are held in Kitty's PayPal account.` : `Paid out to ${pot.organiser_name} through PayPal.`}
              buyUrl={receipt.gift.offer_url}
              notes={[]}
            />
            <p className="text-center"><Link to="/k/$slug/card" params={{ slug }} className="inline-flex min-h-11 items-center text-[14px] underline underline-offset-4">Open the card for {pot.recipient_name}</Link></p>
            <p className="text-center text-[12px] text-muted-foreground">We may earn a commission when you buy through links on this page.</p>
          </>
        )}
      </main>
    </div>
  );
}
