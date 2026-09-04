/** All supported payment method IDs */
export type PaymentMethod = "mesomb" | "flutterwave" | "cod";

/** All app roles — mirrors AppRole in auth.tsx */
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
