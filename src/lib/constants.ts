import { ShieldCheck, Truck, Wallet } from "lucide-react";

/** Platform-wide brand constants */
export const BRAND = {
  name: "J-STORE.cm",
  tagline: "Your Next Trusted Purchase",
  country: "Cameroon",
  supportPhone: "+237 6XX XXX XXX",
  supportEmail: "support@j-store.cm",
  supportHours: "7 days · 8am–10pm WAT",
  office: "Akwa, Douala",
} as const;

/**
 * Orders over this amount in FCFA qualify for free delivery
 * in managed cities (Douala, Yaoundé).
 */
export const FREE_DELIVERY_THRESHOLD = 50_000;

/** Base shipping fee when order is below the free-delivery threshold */
export const BASE_SHIPPING_FEE = 2_500;

/** Platform commission percentage taken from each transaction */
export const PLATFORM_FEE_PCT = 5;

/** Percentage of transaction allocated to delivery */
export const DELIVERY_FEE_PCT = 5;

/** Days before escrow auto-releases to seller if buyer hasn't confirmed */
export const ESCROW_AUTO_RELEASE_DAYS = 7;

/** Trust badges shown on the homepage and checkout */
export const TRUST_BADGES = [
  {
    icon: ShieldCheck,
    title: "Escrow Protected",
    text: "Your money is held until you confirm delivery.",
  },
  {
    icon: Truck,
    title: "Same-day in Douala",
    text: "Express delivery available in Douala & Yaoundé.",
  },
  {
    icon: Wallet,
    title: "MeSomb & Flutterwave",
    text: "MTN MoMo · Orange Money · Card · Bank Transfer",
  },
] as const;

/** Payment methods available at checkout */
export const PAYMENT_METHODS = [
  {
    id: "mesomb" as const,
    label: "MeSomb",
    description: "MTN MoMo · Orange Money · Card",
  },
  {
    id: "flutterwave" as const,
    label: "Flutterwave",
    description: "Mobile Money · Card · Bank Transfer",
  },
  {
    id: "cod" as const,
    label: "Cash on Delivery",
    description: "Pay in cash when order arrives",
  },
] as const;
