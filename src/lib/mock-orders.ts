export type OrderStatus = "placed" | "packed" | "shipping" | "delivered" | "cancelled";

export type Order = {
  id: string;
  date: string;
  total: number;
  itemsCount: number;
  status: OrderStatus;
  rider?: string;
  eta?: string;
  items: { name: string; qty: number; price: number }[];
  address: string;
};

export const ORDERS: Order[] = [
  {
    id: "JS-X7K2P9",
    date: "Today · 10:24",
    total: 47_500,
    itemsCount: 3,
    status: "shipping",
    rider: "Patrice",
    eta: "Today 16:00–18:00",
    address: "Akwa, Douala · Rue Joss",
    items: [
      { name: "Juvani Nocturna Trucker Cap", qty: 1, price: 18_500 },
      { name: "Ankara Linen Shirt", qty: 1, price: 22_000 },
      { name: "Cocoa Body Butter", qty: 1, price: 7_000 },
    ],
  },
  {
    id: "JS-Q3M8L4",
    date: "Yesterday",
    total: 89_000,
    itemsCount: 2,
    status: "delivered",
    address: "Bastos, Yaoundé",
    items: [
      { name: "Wireless Pulse Earbuds", qty: 1, price: 45_000 },
      { name: "Smart Fitness Watch", qty: 1, price: 44_000 },
    ],
  },
  {
    id: "JS-T1N6V2",
    date: "May 22",
    total: 17_000,
    itemsCount: 1,
    status: "placed",
    eta: "Tomorrow",
    address: "Bonapriso, Douala",
    items: [{ name: "Juvani Signature Trucker Collection", qty: 1, price: 17_000 }],
  },
  {
    id: "JS-D9B4F7",
    date: "May 18",
    total: 32_500,
    itemsCount: 2,
    status: "cancelled",
    address: "Bonanjo, Douala",
    items: [
      { name: "Bamboo Sunglasses", qty: 1, price: 12_500 },
      { name: "Handwoven Raffia Hat", qty: 1, price: 20_000 },
    ],
  },
];

export const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  placed: { label: "Order placed", tone: "bg-secondary text-foreground" },
  packed: { label: "Packed", tone: "bg-secondary text-foreground" },
  shipping: { label: "Out for delivery", tone: "bg-gold/15 text-gold border border-gold/30" },
  delivered: {
    label: "Delivered",
    tone: "bg-gold-500/15 text-gold-700 border border-gold-500/30",
  },
  cancelled: {
    label: "Cancelled",
    tone: "bg-destructive/10 text-destructive border border-destructive/30",
  },
};
