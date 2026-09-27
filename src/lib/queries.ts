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

/** Fetch single product by ID - only returns if approved and active */
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("active", true)
      .eq("approved", true)
      .single();
    
    if (error || !data) return null;
    
    return {
      id: data.id,
      name: data.name,
      price: data.price,
      oldPrice: undefined,
      rating: 4.5,
      reviews: 0,
      category: data.category,
      seller: "Seller",
      image: "hsl(25 60% 55%)",
      imageSrc: data.image_url ?? undefined,
      description: data.description ?? "",
    };
  } catch {
    return null;
  }
}

/** Fetch all approved and active products - NO MOCK FALLBACK */
export async function fetchProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .eq("approved", true);
    
    if (error) {
      console.error("Failed to fetch products:", error);
      return [];
    }
    
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      oldPrice: undefined,
      rating: 4.5,
      reviews: 0,
      category: p.category,
      seller: "Seller",
      image: "hsl(25 60% 55%)",
      imageSrc: p.image_url ?? undefined,
      description: p.description ?? "",
    }));
  } catch (err) {
    console.error("Failed to fetch products:", err);
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
  seller_id: string;
  tier: SellerBoostTier;
  ends_at: string | null;
};

/** Fetch all currently active boosts (for shop sorting / badges). */
export async function fetchActiveBoosts(): Promise<ActiveBoost[]> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("seller_boosts")
      .select("seller_id, tier, ends_at")
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gt.${now}`);
    if (error) throw error;
    return (data ?? []) as ActiveBoost[];
  } catch {
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

/** Build a map of seller_id → highest tier for quick lookup. */
export function buildBoostMap(boosts: ActiveBoost[]): Map<string, SellerBoostTier> {
  const m = new Map<string, SellerBoostTier>();
  for (const b of boosts) {
    const existing = m.get(b.seller_id);
    if (!existing || BOOST_TIER_ORDER[b.tier] < BOOST_TIER_ORDER[existing]) {
      m.set(b.seller_id, b.tier);
    }
  }
  return m;
}
