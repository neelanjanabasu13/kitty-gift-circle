// Single place to switch the app's money currency (e.g. to "USD").
export const DEFAULT_CURRENCY: "GBP" | "USD" = "GBP";

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
