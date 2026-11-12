/** Real Channel3 results Kitty found for a demo pot for Priya (titles, shops, prices and photos as returned). Three different kinds of gift. */
export type DemoPick = { id: string; title: string; retailer: string; category: string; price: number; image_url: string; reason: string };

export const DEMO_HOME_PICKS: DemoPick[] = [
  { id: "a", title: "Staub Stoneware Rectangular Baking Dish Set", retailer: "zwilling.com", category: "Cooking", price: 119, image_url: "https://cdn.trychannel3.com/29b30fea-41c4-49b9-aeef-ca1eacc7e737?aid=01M75QZ23Z86H372V10PYA0DEC&mid=YaG3", reason: "Staub combines durable ceramics with Priya's passion for cooking." },
  { id: "b", title: "Small Planter", retailer: "fable.com", category: "Plants", price: 69, image_url: "https://cdn.trychannel3.com/c7a0f97d-a83e-4ecd-8ff3-cdd1270ec26a?aid=01M75S7B9SPATWM80NBFGAB6R1&mid=mr5p", reason: "Priya likes ceramics and this minimalist planter adds warmth to any desk." },
  { id: "c", title: "Vintage Adjustable Book Stand Wooden", retailer: "debenhams.com", category: "Books", price: 43.99, image_url: "https://cdn.trychannel3.com/e7011f5c-c677-48df-92fa-421d49e65c7d?aid=01M75BFKYA7580F4AZVE37RC8K&mid=j49J", reason: "Somewhere to prop her cookbooks open on the counter." },
];
