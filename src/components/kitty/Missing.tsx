import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TopBar } from "./Logo";

export function Missing({ text = "We can't find this kitty. Check the link with the organiser." }: { text?: string }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-md space-y-5 px-5 pt-24 text-center">
        <h1 className="text-[44px]">No kitty <em>here.</em></h1>
        <p className="text-muted-foreground">{text}</p>
        <Button asChild variant="ink" size="xl"><Link to="/">Go to Kitty</Link></Button>
      </div>
    </div>
  );
}
