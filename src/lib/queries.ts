import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  PRODUCTS as MOCK_PRODUCTS,
  CATEGORIES as MOCK_CATEGORIES,
  getReviews as getMockReviews,
  type Product,
  type Review,
} from "@/lib/mock-data";
import type { LucideIcon } from "lucide-react";
import { productsService } from "@/lib/services";
import { supabase } from "@/integrations/supabase/client";

// ── Plain async fetchers (for router loaders — loaders can't call hooks) ─────
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const p = await productsService.getById(id);
    if (p) {
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        oldPrice: undefined,
        rating: 4.5,
        reviews: 0,
        category: p.category,
        seller: "Seller",
        image: "hsl(25 60% 55%)",
        description: p.description ?? "",
      };
    }
  } catch {
    // fall through to mock
  }
  return MOCK_PRODUCTS.find((m) => m.id === id) ?? null;
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    return await fetchProductsFromDb();
  } catch {
    return MOCK_PRODUCTS;
  }
}

export async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const { data, error } = await supabase.from("categories").select("slug, name");
    if (!error && data) {
      return data.map((c: { slug: string; name: string }) => ({
        slug: c.slug,
        name: c.name,
        icon: ICON_MAP.get(c.slug) ?? MOCK_CATEGORIES[0].icon,
      }));
    }
  } catch {
    // fall through
  }
  return MOCK_CATEGORIES;
}

async function fetchProductsFromDb(): Promise<Product[]> {
  const data = await productsService.list({ active: true });
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    oldPrice: undefined,
    rating: 4.5,
    reviews: 0,
    category: p.category,
    seller: "Seller",
    image: "hsl(25 60% 55%)",
    description: p.description ?? "",
  }));
}

// ── React Query hooks ─────────────────────────────────────────────────────

export function useProducts(opts?: { category?: string }): UseQueryResult<Product[]> {
  return useQuery({
    queryKey: ["products", opts?.category],
    queryFn: async () => {
      const list = await fetchProducts();
      if (opts?.category) {
        return list.filter((p) => p.category.toLowerCase() === opts.category);
      }
      return list;
    },
    staleTime: 30_000,
  });
}

export type CategoryItem = { slug: string; name: string; icon: LucideIcon };

const ICON_MAP = new Map<string, LucideIcon>(MOCK_CATEGORIES.map((c) => [c.slug, c.icon]));

export function useCategories(): UseQueryResult<CategoryItem[]> {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });
}

export function useReviews(productId: string): UseQueryResult<Review[]> {
  return useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .eq("product_id", productId);
        if (!error && data && data.length > 0) {
          return data.map((review) => ({
            id: review.id,
            productId: review.product_id,
            author: "Verified buyer",
            rating: review.rating,
            comment: review.comment ?? "",
            date: review.created_at,
          }));
        }
      } catch {
        // fall through
      }
      return getMockReviews(productId);
    },
    staleTime: 30_000,
  });
}
