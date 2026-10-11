import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  CATEGORIES as MOCK_CATEGORIES,
  getReviews as getMockReviews,
  type Product,
  type Review,
} from "@/lib/mock-data";
import type { LucideIcon } from "lucide-react";
import { productsService } from "@/lib/services";
import { supabase } from "@/integrations/supabase/client";
import { BOOST_TIER_ORDER, type SellerBoostTier } from "@/lib/types";

// ── Plain async fetchers (for router loaders — loaders can't call hooks) ─────

/** Fetch single product by ID — only returns it if approved. */
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    return await productsService.getPublicById(id);
  } catch (err) {
    console.error("Failed to fetch product:", err);
    return null;
  }
}

/** Fetch all approved products (title/base_price/status schema, via productsService). */
export async function fetchProducts(): Promise<Product[]> {
  try {
    return await productsService.listPublic();
  } catch (err) {
    console.error("Failed to fetch products:", err);
    return [];
  }
}

/** Top-selling product ids (last 90 days), computed server-side from real orders. */
export async function fetchBestSellerIds(limit = 8): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("get_best_sellers", { p_limit: limit });
    if (error) throw error;
    return (data ?? []).map((r) => r.product_id);
  } catch (err) {
    console.error("Failed to fetch best sellers:", err);
    return [];
  }
}

/** Fetch categories - returns mock as fallback since categories are platform-defined */
export async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const { data, error } = await supabase.from("categories").select("slug, name");
    if (!error && data && data.length > 0) {
      return data.map((c: { slug: string; name: string }) => ({
        slug: c.slug,
        name: c.name,
        icon: ICON_MAP.get(c.slug) ?? MOCK_CATEGORIES[0].icon,
      }));
    }
  } catch {
    // fall through
  }
  // Categories are platform-defined, so mock fallback is acceptable
  return MOCK_CATEGORIES;
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

// ── Seller boost helpers ──────────────────────────────────────────────────

export type ActiveBoost = {
  product_id: string;
  tier: SellerBoostTier;
};

/**
 * Active boosts per approved product (best tier of the owning store). Goes
 * through a database function because buyers can't read seller_boosts directly.
 */
export async function fetchActiveBoosts(): Promise<ActiveBoost[]> {
  try {
    const { data, error } = await supabase.rpc("get_active_product_boosts");
    if (error) throw error;
    return (data ?? []) as ActiveBoost[];
  } catch (err) {
    console.error("Failed to fetch boosts:", err);
    return [];
  }
}

export function useActiveBoosts(): UseQueryResult<ActiveBoost[]> {
  return useQuery({
    queryKey: ["active-boosts"],
    queryFn: fetchActiveBoosts,
    staleTime: 60_000,
  });
}

/** Map of product_id → boost tier for quick lookup. */
export function buildBoostMap(boosts: ActiveBoost[]): Map<string, SellerBoostTier> {
  const m = new Map<string, SellerBoostTier>();
  for (const b of boosts) {
    const existing = m.get(b.product_id);
    if (!existing || BOOST_TIER_ORDER[b.tier] < BOOST_TIER_ORDER[existing]) {
      m.set(b.product_id, b.tier);
    }
  }
  return m;
}
