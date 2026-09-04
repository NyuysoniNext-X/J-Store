import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRODUCTS, type Product } from "./mock-data";

type CartItem = { id: string; qty: number };

type CartState = {
  items: CartItem[];
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  detailed: () => Array<{ product: Product; qty: number }>;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (id, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.id === id);
          return existing
            ? { items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i)) }
            : { items: [...s.items, { id, qty }] };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      detailed: () =>
        get()
          .items.map((i) => {
            const product = PRODUCTS.find((p) => p.id === i.id);
            return product ? { product, qty: i.qty } : null;
          })
          .filter(Boolean) as Array<{ product: Product; qty: number }>,
      subtotal: () =>
        get().items.reduce((sum, i) => {
          const p = PRODUCTS.find((p) => p.id === i.id);
          return sum + (p ? p.price * i.qty : 0);
        }, 0),
    }),
    { name: "jstore.cart" },
  ),
);

function useCartDetailed(): Array<{ product: Product; qty: number }> {
  const items = useCart((s) => s.items);
  return useMemo(
    () =>
      items
        .map((i) => {
          const product = PRODUCTS.find((p) => p.id === i.id);
          return product ? { product, qty: i.qty } : null;
        })
        .filter(Boolean) as Array<{ product: Product; qty: number }>,
    [items],
  );
}

export default useCartDetailed;

export function useCartSubtotal(): number {
  const detailed = useCartDetailed();
  return useMemo(
    () => detailed.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
    [detailed],
  );
}

type WishState = {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};
export const useWishlist = create<WishState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })),
      has: (id) => get().ids.includes(id),
    }),
    { name: "jstore.wishlist" },
  ),
);
