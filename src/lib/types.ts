/** All supported payment method IDs */
export type PaymentMethod = "momo" | "orange" | "card" | "cod";

/** All app roles — mirrors the app_role enum in the database */
export type Role = "customer" | "seller" | "admin" | "super_admin" | "delivery" | "partner";

/** Category slugs that map to the CATEGORIES array in mock-data.ts */
export type CategorySlug =
  | "fashion"
  | "electronics"
  | "school"
  | "home"
  | "beauty"
  | "sports"
  | "accessories";

/** Delivery-specific order status values */
export type DeliveryStatus =
  | "unassigned"
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered";

/** Address used at checkout */
export type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  zone: string;
};

/** Seller boost/virality tiers */
export type SellerBoostTier = "normal" | "featured" | "top_seller" | "sponsored";

/** Priority order for boost tiers — higher index = higher priority */
export const BOOST_TIER_ORDER: SellerBoostTier[] = [
  "normal",
  "featured",
  "top_seller",
  "sponsored",
];

/** Human-readable labels for boost tiers */
export const BOOST_TIER_LABELS: Record<SellerBoostTier, string> = {
  normal: "Normal",
  featured: "Featured",
  top_seller: "Top Seller",
  sponsored: "Sponsored",
};

/**
 * Platform-owned Mobile Money accounts buyers pay into at checkout. Real
 * numbers belong in env vars, not committed here — placeholders until ops
 * supplies the live MTN/Orange merchant numbers.
 */
export const PLATFORM_MOMO: Record<
  "mtn" | "orange",
  { provider: string; label: string; number: string }
> = {
  mtn: { provider: "MTN MoMo", label: "MTN MoMo", number: "+237 6XX XXX XXX" },
  orange: { provider: "Orange Money", label: "Orange Money", number: "+237 6XX XXX XXX" },
};