import { OCCASIONS } from "./config";

export function formatMoney(amount: number, currency: string, opts: { exact?: boolean } = {}) {
  const whole = Number.isInteger(amount) && !opts.exact;
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Suggested share: target split across expected people, rounded up to the nearest whole unit. */
export function suggestedAmount(target: number, expected: number) {
  if (!expected || expected < 1) return Math.ceil(target);
  return Math.max(1, Math.ceil(target / expected));
}

/** Amount chips: suggested first, then £5/£10/£15/£20 without duplicates. */
export function amountChips(target: number, expected: number) {
  const s = suggestedAmount(target, expected);
  return [s, ...[5, 10, 15, 20].filter((v) => v !== s)];
}

export function meterPercent(raised: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

export function stillToChipIn(expected: number, people: number) {
  return Math.max(0, expected - people);
}

export function occasionNoun(occasion: string) {
  return OCCASIONS.find((o) => o.value === occasion)?.noun ?? "";
}

export function shareMessage(name: string, occasion: string, link: string) {
  const noun = occasionNoun(occasion);
  const what = noun ? `${name}'s ${noun} gift` : `${name}'s gift`;
  return `Chipping in for ${what}. It's a hold, so nobody's charged unless the gift happens: ${link}`;
}

/** Statuses that count as money in the pot (held or paid). */
export const LIVE_STATUSES = ["authorized", "reauthorized", "captured"] as const;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
