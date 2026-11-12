/**
 * Real Channel3 results Kitty found for a demo pot for Priya. Three different kinds of gift.
 * Photos ship with the app (600px webp) so /demo makes no network calls. Original Channel3 sources:
 * - Staub Stoneware Rectangular Baking Dish Set, zwilling.com, £119: https://cdn.trychannel3.com/29b30fea-41c4-49b9-aeef-ca1eacc7e737
 * - Small Planter, fable.com, £69: https://cdn.trychannel3.com/c7a0f97d-a83e-4ecd-8ff3-cdd1270ec26a
 * - Vintage Adjustable Book Stand Wooden, debenhams.com, £43.99: https://cdn.trychannel3.com/e7011f5c-c677-48df-92fa-421d49e65c7d
 */
import staubImg from "@/assets/demo_staub_baking_dish.webp";
import planterImg from "@/assets/demo_small_planter.webp";
import standImg from "@/assets/demo_book_stand.webp";

export type DemoPick = { id: string; title: string; retailer: string; category: string; price: number; image_url: string; reason: string };

export const DEMO_IMAGES = [staubImg, planterImg, standImg];

export const DEMO_HOME_PICKS: DemoPick[] = [
  { id: "a", title: "Staub Stoneware Rectangular Baking Dish Set", retailer: "zwilling.com", category: "Cooking", price: 119, image_url: staubImg, reason: "Staub combines durable ceramics with Priya's passion for cooking." },
  { id: "b", title: "Small Planter", retailer: "fable.com", category: "Plants", price: 69, image_url: planterImg, reason: "Priya likes ceramics and this minimalist planter adds warmth to any desk." },
  { id: "c", title: "Vintage Adjustable Book Stand Wooden", retailer: "debenhams.com", category: "Books", price: 43.99, image_url: standImg, reason: "Somewhere to prop her cookbooks open on the counter." },
];
