import type { PaymentProvider, PaymentIntent } from "./index";

/**
 * MeSomb payment gateway integration.
 *
 * MeSomb is a Cameroonian payment aggregator supporting
 * MTN MoMo, Orange Money, and card payments.
 *
 * Docs: https://mesomb.com/developers
 */
export const mesombProvider: PaymentProvider = {
  id: "mesomb",
  label: "MeSomb",
  description: "MTN MoMo · Orange Money · Card",

  async createIntent(amount: number, metadata?: Record<string, unknown>) {
    const reference = `MESOMB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (import.meta.env.DEV) {
      console.info("[MeSomb] Creating payment intent", { amount, reference, metadata });
      return {
        id: reference,
        provider: "mesomb" as const,
        amount,
        currency: "XAF",
        status: "pending" as const,
        reference,
      };
    }

    const response = await fetch("https://api.mesomb.com/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: "XAF",
        reference,
        ...metadata,
      }),
    });

    if (!response.ok) throw new Error(`MeSomb payment failed: ${response.statusText}`);
    const result = await response.json();

    return {
      id: result.id ?? reference,
      provider: "mesomb" as const,
      amount,
      currency: "XAF",
      status: result.status === "success" ? ("completed" as const) : ("pending" as const),
      reference,
      providerResponse: result,
    };
  },

  async verifyIntent(reference: string) {
    if (import.meta.env.DEV) {
      console.info("[MeSomb] Verifying payment", { reference });
      return {
        id: reference,
        provider: "mesomb" as const,
        amount: 0,
        currency: "XAF",
        status: "completed" as const,
        reference,
      };
    }

    const response = await fetch(`https://api.mesomb.com/v1/payments/${reference}/status`);
    if (!response.ok) throw new Error(`MeSomb verification failed: ${response.statusText}`);
    const result = await response.json();

    return {
      id: reference,
      provider: "mesomb" as const,
      amount: result.amount ?? 0,
      currency: "XAF",
      status: result.status === "success" ? ("completed" as const) : ("failed" as const),
      reference,
      providerResponse: result,
    };
  },
};
