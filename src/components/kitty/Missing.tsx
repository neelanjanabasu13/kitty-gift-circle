import { NotFoundPage } from "./States";

export function Missing({ text }: { text?: string }) {
  return text ? <NotFoundPage text={text} /> : <NotFoundPage />;
}
