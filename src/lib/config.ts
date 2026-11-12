// Single place to switch market: GB/GBP by default, change to US/USD for the US.
export const MARKET: { country: "GB" | "US"; currency: "GBP" | "USD" } = { country: "GB", currency: "GBP" };
export const DEFAULT_CURRENCY = MARKET.currency;

/** Fixed gift categories the agent may assign (organiser extras are added per pot). */
export const BASE_CATEGORIES = ["cooking", "books", "experiences", "plants", "home", "wellbeing", "tech", "crafts"];

/** Pot sizes at which Kitty runs a fresh shop search. */
export const SEARCH_BANDS = [30, 50, 75, 100, 150, 200];

export const OCCASIONS = [
  { value: "leaving", label: "Leaving do", noun: "leaving" },
  { value: "birthday", label: "Birthday", noun: "birthday" },
  { value: "teacher_thank_you", label: "Teacher thank-you", noun: "thank-you" },
  { value: "wedding", label: "Wedding", noun: "wedding" },
  { value: "new_baby", label: "New baby", noun: "new baby" },
  { value: "other", label: "Something else", noun: "" },
] as const;

export const CLOSENESS = [
  { value: "close_friend", label: "Close friend" },
  { value: "family", label: "Family" },
  { value: "colleague", label: "Colleague" },
  { value: "kids_classmate", label: "Kid's classmate" },
  { value: "teacher", label: "Teacher" },
] as const;

export const INTERESTS = [
  "cooking", "books", "experiences", "plants", "home", "wellbeing",
  "tech", "crafts", "ceramics", "coffee", "fitness", "travel",
];

export const VOTE_WINDOWS = [
  { value: "off", label: "Off" },
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "1 day" },
  { value: "all_in", label: "Until everyone's voted" },
] as const;

export type Occasion = (typeof OCCASIONS)[number]["value"];
export type Closeness = (typeof CLOSENESS)[number]["value"];
export type VoteWindow = (typeof VOTE_WINDOWS)[number]["value"];

/** Public site address for share links; falls back to the current origin when unset. */
export const PUBLIC_SITE_URL: string = (import.meta.env["VITE_PUBLIC_SITE_URL"] as string | undefined) ?? "";
