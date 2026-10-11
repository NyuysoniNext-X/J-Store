import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import {
  fetchCategories,
  fetchProducts,
  useCategories,
  fetchActiveBoosts,
  buildBoostMap,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { BOOST_TIER_ORDER, type SellerBoostTier } from "@/lib/types";
import type { Product } from "@/lib/mock-data";

type Search = { category?: string; sort?: string; q?: string };

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  validateSearch: (s: Search): Search => ({
    category: typeof s.category === "string" ? s.category : undefined,
    sort: typeof s.sort === "string" ? s.sort : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  loader: async () => {
    const [products, categories, boosts] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchActiveBoosts(),
    ]);
    return { products, categories, boosts };
  },
  head: () => ({
    meta: [
      { title: "Shop all products — J-STORE.cm" },
      {
        name: "description",
        content: "Browse thousands of premium products from verified African sellers on J-STORE.",
      },
    ],
  }),
});

const SORTS = [
  { id: "featured", label: "Recommended" },
  { id: "price-asc", label: "Price: low → high" },
  { id: "price-desc", label: "Price: high → low" },
  { id: "rating", label: "Top rated" },
];

type ProductWithBoost = Product & { boostTier?: SellerBoostTier };

function ShopPage() {
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  const { products, categories: CATEGORIES, boosts } = Route.useLoaderData();
  const [maxPrice, setMaxPrice] = useState(100_000);
  const [openMobile, setOpenMobile] = useState(false);

  const boostMap = useMemo(() => buildBoostMap(boosts), [boosts]);

  const filtered = useMemo(() => {
    // Enrich products with boost tier (mock products have no seller_id, so default to 'normal')
    let list: ProductWithBoost[] = products.map((p) => ({
      ...p,
      boostTier: (boostMap.get(p.id) ?? "normal") as SellerBoostTier,
    }));

    if (search.q) {
      const q = search.q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.seller.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }
    if (search.category) {
      const wanted =
        CATEGORIES.find((c) => c.slug === search.category)?.name.toLowerCase() ?? search.category;
      list = list.filter((p) => p.category.toLowerCase() === wanted);
    }
    list = list.filter((p) => p.price <= maxPrice);

    const sort = search.sort ?? "featured";
    if (sort === "featured") {
      // Sort by boost tier first, then by rating
      list.sort((a, b) => {
        const orderA = BOOST_TIER_ORDER[a.boostTier ?? "normal"];
        const orderB = BOOST_TIER_ORDER[b.boostTier ?? "normal"];
        if (orderA !== orderB) return orderA - orderB;
        return b.rating - a.rating;
      });
    } else if (sort === "price-asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sort === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    }
    return list;
  }, [products, search.q, CATEGORIES, search.category, search.sort, maxPrice, boostMap]);

  const Sidebar = (
    <aside className="space-y-8 text-sm">
      <div>
        <h4 className="font-display font-semibold mb-3">Categories</h4>
        <div className="space-y-1">
          <button
            onClick={() => nav({ search: (s: Search) => ({ ...s, category: undefined }) })}
            className={`block w-full text-left py-1.5 px-3 rounded-lg ${!search.category ? "bg-navy text-navy-foreground" : "hover:bg-muted"}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => nav({ search: (s: Search) => ({ ...s, category: c.slug }) })}
              className={`block w-full text-left py-1.5 px-3 rounded-lg ${search.category === c.slug ? "bg-navy text-navy-foreground" : "hover:bg-muted"}`}
            >
              <c.icon className="h-4 w-4 inline-block mr-1.5 text-gold" /> {c.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-8">
      <nav className="text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">Shop</span>
        {search.category && (
          <>
            {" "}
            / <span className="capitalize">{search.category}</span>
          </>
        )}
      </nav>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold capitalize">
            {search.q ? `Results for "${search.q}"` : (search.category ?? "All products")}
          </h1>
          {search.q && (
            <button
              onClick={() => nav({ search: (s: Search) => ({ ...s, q: undefined }) })}
              className="text-xs text-gold hover:underline mt-1 inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear search
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden rounded-full"
            onClick={() => setOpenMobile(true)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
          </Button>
          <select
            value={search.sort ?? "featured"}
            onChange={(e) => nav({ search: (s: Search) => ({ ...s, sort: e.target.value }) })}
            className="h-10 rounded-full px-4 bg-secondary text-sm border border-transparent focus:outline-none focus:border-gold"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid lg:grid-cols-[240px_1fr] gap-10">
        <div className="hidden lg:block">{Sidebar}</div>
        <div>
          <p className="text-sm text-muted-foreground mb-4">{filtered.length} products</p>
          {filtered.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl">
              <p className="font-display text-xl">
                {search.q ? `No results for "${search.q}"` : "No products match your filters"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search.q
                  ? "Try a different word, or browse by category instead."
                  : "Try widening your selection."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} boostTier={p.boostTier} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="font-display text-lg font-semibold">Filters</p>
              <button onClick={() => setOpenMobile(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
