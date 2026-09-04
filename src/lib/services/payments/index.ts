import { mesombProvider } from "./mesomb";
import { flutterwaveProvider } from "./flutterwave";

export type PaymentProviderId = "mesomb" | "flutterwave" | "cod";

export type PaymentIntent = {
  id: string;
  provider: PaymentProviderId;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  reference: string;
  providerResponse?: Record<string, unknown>;
};

export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  description: string;
  createIntent(amount: number, metadata?: Record<string, unknown>): Promise<PaymentIntent>;
  verifyIntent(reference: string): Promise<PaymentIntent>;
}

const providers: Record<PaymentProviderId, PaymentProvider> = {
  mesomb: mesombProvider,
  flutterwave: flutterwaveProvider,
  cod: {
    id: "cod",
    label: "Cash on Delivery",
    description: "Pay in cash when your order arrives",
    async createIntent(amount: number) {
      return {
        id: `cod-${Date.now()}`,
        provider: "cod",
        amount,
        currency: "XAF",
        status: "pending",
        reference: `COD-${Date.now()}`,
      };
    },
    async verifyIntent(reference: string) {
      return {
        id: reference,
        provider: "cod",
        amount: 0,
        currency: "XAF",
        status: "completed",
        reference,
      };
    },
  },
};

export const paymentsService = {
  getProvider(id: PaymentProviderId): PaymentProvider {
    return providers[id];
  },

  listProviders(): PaymentProvider[] {
    return Object.values(providers);
  },

  async createIntent(
    providerId: PaymentProviderId,
    amount: number,
    metadata?: Record<string, unknown>,
  ) {
    const provider = this.getProvider(providerId);
    return provider.createIntent(amount, metadata);
  },

  async verifyIntent(providerId: PaymentProviderId, reference: string) {
    const provider = this.getProvider(providerId);
    return provider.verifyIntent(reference);
  },
};
