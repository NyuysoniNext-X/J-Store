export type DeliveryTier = {
  name: string;
  time: string;
  fee: number; // 0 = "arranged" (seller handles)
};

export type DeliveryZone = {
  city: string;
  managed: boolean; // true = J-STORE handles delivery
  tiers: DeliveryTier[];
};

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    city: "Douala",
    managed: true,
    tiers: [
      { name: "Express", time: "2–4 hours", fee: 2_500 },
      { name: "Standard", time: "Same day", fee: 1_500 },
      { name: "Pickup", time: "J-STORE hub (free)", fee: 0 },
    ],
  },
  {
    city: "Yaoundé",
    managed: true,
    tiers: [
      { name: "Express", time: "4–6 hours", fee: 2_500 },
      { name: "Standard", time: "Next day", fee: 2_000 },
      { name: "Pickup", time: "J-STORE hub (free)", fee: 0 },
    ],
  },
  {
    city: "Bafoussam",
    managed: false,
    tiers: [{ name: "Standard", time: "1–2 days", fee: 3_500 }],
  },
  {
    city: "Buea",
    managed: false,
    tiers: [{ name: "Standard", time: "1–2 days", fee: 3_000 }],
  },
  {
    city: "Garoua",
    managed: false,
    tiers: [{ name: "Standard", time: "2–3 days", fee: 4_500 }],
  },
  {
    city: "Bamenda",
    managed: false,
    tiers: [{ name: "Standard", time: "2–3 days", fee: 4_000 }],
  },
];

/** Returns the zone config for a city, or Douala as fallback. */
export function getCity(city: string): DeliveryZone {
  return (
    DELIVERY_ZONES.find((z) => z.city.toLowerCase() === city.toLowerCase()) ?? DELIVERY_ZONES[0]
  );
}
