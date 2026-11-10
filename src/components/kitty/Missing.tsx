import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

export function Missing({ text = "We can't find this kitty. Check the link with the organiser." }: { text?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-warm px-6 text-center">
      <div className="max-w-sm space-y-4">
        <Logo />
        <h1 className="font-display text-3xl font-semibold">Hmm, no kitty here.</h1>
        <p className="text-muted-foreground">{text}</p>
        <Button asChild variant="hero" size="xl"><Link to="/">Go to Kitty</Link></Button>
      </div>
    </div>
  );
}
