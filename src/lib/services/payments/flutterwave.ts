import type { PaymentProvider, PaymentIntent } from "./index";

/**
 * Flutterwave payment gateway integration.
 *
 * Flutterwave is a pan-African payment gateway supporting
 * Mobile Money, cards, bank transfers, and more.
 *
 * Docs: https://developer.flutterwave.com
 */
export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",
  label: "Flutterwave",
  description: "Mobile Money · Card · Bank Transfer",

  async createIntent(amount: number, metadata?: Record<string, unknown>) {
    const reference = `FLW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (import.meta.env.DEV) {
      console.info("[Flutterwave] Creating payment intent", { amount, reference, metadata });
      return {
        id: reference,
        provider: "flutterwave" as const,
        amount,
        currency: "XAF",
        status: "pending" as const,
        reference,
      };
    }

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency: "XAF",
        ...metadata,
      }),
    });

    if (!response.ok) throw new Error(`Flutterwave payment failed: ${response.statusText}`);
    const result = await response.json();

    return {
      id: result.id?.toString() ?? reference,
      provider: "flutterwave" as const,
      amount,
      currency: "XAF",
      status: result.status === "successful" ? ("completed" as const) : ("pending" as const),
      reference,
      providerResponse: result,
    };
  },

  async verifyIntent(reference: string) {
    if (import.meta.env.DEV) {
      console.info("[Flutterwave] Verifying payment", { reference });
      return {
        id: reference,
        provider: "flutterwave" as const,
        amount: 0,
        currency: "XAF",
        status: "completed" as const,
        reference,
      };
    }

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${reference}/verify`);
    if (!response.ok) throw new Error(`Flutterwave verification failed: ${response.statusText}`);
    const result = await response.json();

    return {
      id: reference,
      provider: "flutterwave" as const,
      amount: result.data?.amount ?? 0,
      currency: "XAF",
      status: result.data?.status === "successful" ? ("completed" as const) : ("failed" as const),
      reference,
      providerResponse: result.data,
    };
  },
};
