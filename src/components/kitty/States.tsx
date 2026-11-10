import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { KittyMascot, type MascotState } from "./KittyMascot";
import { TopBar } from "./Logo";

/** Empty state: idle mascot and one helpful line. */
export function EmptyState({ line, state = "idle", size = 96 }: { line: string; state?: MascotState; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <KittyMascot state={state} size={size} />
      <p className="max-w-sm text-[15px] text-muted-foreground">{line}</p>
    </div>
  );
}

/** Error state in Kitty's voice, with a retry that re-runs the loader. */
export function ErrorState({ line = "Something tripped me up loading this. Nothing about your money has changed.", onRetry }: { line?: string; onRetry?: () => void }) {
  const router = useRouter();
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
      <KittyMascot state="cancelled" size={120} />
      <h2 className="text-[32px]">That didn't <em>load.</em></h2>
      <p className="max-w-sm text-[15px] text-muted-foreground">{line}</p>
      <Button variant="ink" size="xl" onClick={() => (onRetry ? onRetry() : void router.invalidate())}>Try again</Button>
    </div>
  );
}

/** Full-page skeleton for any pot screen while it loads: warm tan shimmer, no spinners. */
export function PotSkeleton() {
  return (
    <div className="min-h-screen" aria-busy="true" aria-label="Loading the kitty">
      <TopBar />
      <div className="mx-auto max-w-6xl space-y-8 px-5 pt-8 md:px-8">
        <div className="h-4 w-32 rounded-full shimmer" />
        <div className="h-14 w-2/3 max-w-md rounded-[14px] shimmer" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
          <div className="h-80 rounded-[14px] shimmer" />
          <div className="space-y-4">
            <div className="h-14 w-40 rounded-[12px] shimmer" />
            <div className="h-2.5 rounded-full shimmer" />
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-[12px] shimmer" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PotErrorPage() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-md px-5 pt-16"><ErrorState /></main>
    </div>
  );
}

/** Not-found pot: the mascot shrugs (head tilt) and points home. */
export function NotFoundPage({ title = <>No kitty <em>here.</em></>, text = "I can't find this kitty. Check the link with the organiser." }: { title?: React.ReactNode; text?: string }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-md space-y-5 px-5 pt-16 text-center">
        <KittyMascot state="veto" size={160} className="mx-auto block" />
        <h1 className="text-[44px]">{title}</h1>
        <p className="text-muted-foreground">{text}</p>
        <Button asChild variant="ink" size="xl"><Link to="/">Go to Kitty</Link></Button>
      </main>
    </div>
  );
}
