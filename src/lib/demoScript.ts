/** The guided demo story for Priya's pot: who chips in, what they suggest, who votes. Pure data, no I/O. */
export type DemoPerson = {
  name: string;
  amount: number;
  visibility: "named" | "anonymous" | "amount_hidden";
  /** A "what does she like" suggestion; undefined means they skipped the question. */
  suggests?: string;
  message?: string;
  /** Final vote: 0 = Kitty's top pick, 1 = second pick, undefined = didn't vote. */
  vote?: 0 | 1;
};

export const DEMO_STORY_FACTOR = 180; // 1h vote = 20s, 2h countdown = 40s, 2 day deadline = 16 min
export const DEMO_TARGET = 120;
export const DEMO_GAP_MS = 6000; // a new chip-in roughly every six seconds

export const DEMO_CAST: DemoPerson[] = [
  { name: "Jo", amount: 20, visibility: "named", suggests: "ceramics", message: "Priya! The kitchen won't be the same without you.", vote: 0 },
  { name: "Sam", amount: 15, visibility: "named", vote: 0 },
  { name: "Ravi", amount: 25, visibility: "amount_hidden", suggests: "coffee", message: "Best desk neighbour I've ever had. Keep in touch!", vote: 1 },
  { name: "", amount: 10, visibility: "anonymous" },
  { name: "Aisha", amount: 15, visibility: "named", suggests: "cooking", message: "Thank you for every coffee run and every kind word.", vote: 0 },
  { name: "Tom", amount: 10, visibility: "named" },
  { name: "Mei", amount: 12, visibility: "named", suggests: "ceramics", message: "Send pictures of everything you make.", vote: 1 },
  { name: "Grace", amount: 10, visibility: "named", message: "Wishing you the happiest next chapter.", vote: 0 },
  { name: "Leo", amount: 13, visibility: "named", suggests: "cooking" },
];

export const DEMO_TOTAL = DEMO_CAST.reduce((s, p) => s + p.amount, 0);
/** Chip-in counts after which Kitty runs a fresh search (the pot has crossed £50, then £100). */
export const DEMO_SEARCH_AT = [3, 7];

export type DemoStage = "chipping" | "closing" | "voting" | "countdown" | "buying" | "done" | "cancelled";

export function demoStage(status: string, chipped: number): DemoStage {
  if (status === "collecting") return chipped < DEMO_CAST.length ? "chipping" : "closing";
  if (status === "voting") return "voting";
  if (status === "veto") return "countdown";
  if (status === "buying") return "buying";
  if (status === "done") return "done";
  return "cancelled";
}

export function demoLine(p: DemoPerson): string {
  const who = p.visibility === "anonymous" ? "Someone" : p.name;
  const amt = p.visibility === "named" ? ` £${p.amount}` : "";
  const like = p.suggests ? ` and suggested ${p.suggests}, so I've noted it` : p.visibility === "anonymous" ? "" : ", skipping the 'what does she like' question";
  return `${who} just chipped in${amt}${like}.`;
}
