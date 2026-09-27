import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Product } from "./mock-data";
import { useProducts } from "./queries";

type CartItem = { id: string; qty: number };

type CartState = {
  items: CartItem[];
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: () => number;
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
    }),
    { name: "jstore.cart" },
  ),
);

// Cart items only hold {id, qty} — product details (price, name, image,
// stock) always come fresh from the live product list, never from a
// snapshot, so a price change or a product going out of stock/unapproved
// is reflected immediately rather than trusting whatever was true when the
// item was added to the cart.
function useCartDetailed(): Array<{ product: Product; qty: number }> {
  const rawItems = useCart((s) => s.items);
  const { data: allProducts = [] } = useProducts();
  return useMemo(
    () =>
      rawItems
        .map((i) => {
          const product = allProducts.find((p) => p.id === i.id);
          return product ? { product, qty: i.qty } : null;
        })
        .filter(Boolean) as Array<{ product: Product; qty: number }>,
    [rawItems, allProducts],
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
