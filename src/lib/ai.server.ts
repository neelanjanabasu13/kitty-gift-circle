// Lovable AI calls: plan search queries and score candidates. No money decisions here.
import { generateChatCompletion } from "@lovable.dev/ai-gateway";

const MODEL = "google/gemini-3.8-flash" as const;

async function askJson<T>(system: string, user: string): Promise<T> {
  const res = await generateChatCompletion({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  const content = (res as any)?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p: any) => p?.text ?? "").join("") : "";
  return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T;
}

export type Profile = {
  name: string;
  occasion: string;
  closeness: string;
  likes: string[];
  dislikes: string[];
  wishlist: string | null;
  topVoted: string[];
  pot: number;
  currency: string;
};

export async function planQueries(p: Profile): Promise<string[]> {
  const out = await askJson<{ queries: string[] }>(
    "You plan product searches for a group gift. Return JSON {\"queries\": string[]} with 4 to 6 short shop search queries. Each query names ONE concrete product type (e.g. 'cast iron casserole dish', 'pasta making class'), never a category or a list. Respect dislikes. UK English.",
    JSON.stringify({ recipient: p.name, occasion: p.occasion, relationship: p.closeness, likes: p.likes, dislikes: p.dislikes, wishlist: p.wishlist, group_voted_categories: p.topVoted, budget: `${p.pot} ${p.currency}` }),
  );
  return (out.queries ?? []).map((q) => String(q).trim()).filter(Boolean).slice(0, 6);
}

export type AiScore = { id: string; fit: number; reason: string; category: string; dislike: boolean };

export async function scoreCandidates(p: Profile, categories: string[], items: { id: string; title: string; category: string | null; price: number; retailer: string }[]): Promise<AiScore[]> {
  if (!items.length) return [];
  const out = await askJson<{ items: AiScore[] }>(
    `You judge how well each product suits a gift recipient. Return JSON {"items": [{"id", "fit", "reason", "category", "dislike"}]} for every input item.
- fit: 0..1, how well it suits this specific person (0.4 or below means a poor fit).
- reason: ONE warm line under 90 characters that names one of their likes, e.g. "She loves cast iron; this is the 24 cm she would use". Use their first name or she/he/they naturally. No em dashes.
- category: exactly one of ${JSON.stringify(categories)}.
- dislike: true if it clashes with any dislike.`,
    JSON.stringify({ recipient: p.name, occasion: p.occasion, relationship: p.closeness, likes: p.likes, dislikes: p.dislikes, wishlist: p.wishlist, items }),
  );
  return (out.items ?? []).map((s) => ({
    id: String(s.id),
    fit: Math.max(0, Math.min(1, Number(s.fit) || 0)),
    reason: String(s.reason ?? "").replace(/\u2014/g, ",").slice(0, 140),
    category: categories.includes(String(s.category)) ? String(s.category) : categories[0]!,
    dislike: !!s.dislike,
  }));
}

/** One warm why-line for the veto screen. Falls back to plain facts if AI is unavailable. */
export async function explainChoice(o: { name: string; likes: string[]; title: string; retailer: string | null; votes: number; voted: number; contributors: number; reason: string | null }): Promise<string> {
  // The vote count is plain code so it's always exact; AI only writes the warm part.
  const { votePhrase } = await import("./closing");
  const lead = votePhrase(o.votes, o.voted, o.contributors);
  const pre = lead ? `${lead} ` : "";
  const fallback = `${pre}${o.reason ?? `It fits what ${o.name} is into.`}${o.retailer ? ` In stock at ${o.retailer}.` : ""}`;
  try {
    const out = await askJson<{ why: string }>(
      'Write ONE warm, plain-English line (under 150 characters, UK spelling, no em dashes) explaining why this group gift was chosen. Do NOT mention votes or numbers. Mention one of the recipient\'s likes and the shop. Return JSON {"why": string}. Example: "It fits her cooking and cast-iron likes, and it\'s in stock at John Lewis."',
      JSON.stringify({ name: o.name, likes: o.likes, title: o.title, retailer: o.retailer, reason: o.reason }),
    );
    const w = String(out.why ?? "").replace(/\u2014/g, ",").trim();
    return w ? `${pre}${w.slice(0, 160)}` : fallback;
  } catch {
    return fallback;
  }
}

/** One short reminder nudge in Kitty's voice. `[link]` is swapped for the share link in the app. */
export async function draftNudge(o: { name: string; occasion: string; missing: number }): Promise<string> {
  const occ = o.occasion ? `${o.occasion} ` : "";
  const fallback = `Quick one: we're chipping in for ${o.name}'s ${occ}gift. It's a hold, so nobody's charged unless the gift happens. [link]`;
  try {
    const res = await generateChatCompletion({
      model: "google/gemini-3.1-flash-lite",
      messages: [
        { role: "system", content: 'Write ONE friendly reminder message (under 200 characters, UK spelling, no em dashes) a colleague could paste into WhatsApp to nudge people who have not chipped in to a group gift yet. Mention it is a hold, so nobody is charged unless the gift happens. End with the literal token [link]. Return JSON {"text": string}. Example: "Quick one: we\'re chipping in for Priya\'s leaving gift. It\'s a hold, so nobody\'s charged unless the gift happens. [link]"' },
        { role: "user", content: JSON.stringify(o) },
      ],
      response_format: { type: "json_object" },
    });
    const c = (res as any)?.choices?.[0]?.message?.content;
    const text = String(JSON.parse(String(typeof c === "string" ? c : "").replace(/^```(json)?|```$/g, "").trim()).text ?? "").replace(/\u2014/g, ",").trim();
    if (!text) return fallback;
    return (text.includes("[link]") ? text : `${text} [link]`).slice(0, 300);
  } catch {
    return fallback;
  }
}
