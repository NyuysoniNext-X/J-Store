/**
 * Notification helpers — currently mock-safe (log to console in dev, would
 * call a Supabase Edge Function or external service in production).
 *
 * All functions are no-ops when called outside a Supabase environment.
 */

interface OrderNotificationPayload {
  phone: string;
  email?: string | null;
  orderId: string;
  total: number;
}

/**
 * Send a WhatsApp / SMS order confirmation to the buyer.
 * In production this would trigger a Supabase Edge Function that calls
 * a WhatsApp Business API or Twilio SMS.
 */
export async function notifyOrderPlaced(payload: OrderNotificationPayload): Promise<void> {
  if (import.meta.env.DEV) {
    console.info("[notifications] Order placed notification →", payload);
    // Simulate async latency
    await new Promise((r) => setTimeout(r, 300));
  }
  // TODO: call supabase.functions.invoke("notify-order-placed", { body: payload })
}

/**
 * Send a PDF invoice to the buyer's email address.
 * In production: trigger an Edge Function that renders a PDF and emails it.
 */
export async function sendInvoice(payload: {
  email?: string | null;
  orderId: string;
  total: number;
}): Promise<void> {
  if (import.meta.env.DEV) {
    console.info("[notifications] Invoice →", payload);
    await new Promise((r) => setTimeout(r, 200));
  }
  // TODO: call supabase.functions.invoke("send-invoice", { body: payload })
}

/**
 * Notify seller when they receive a new order.
 */
export async function notifySeller(payload: {
  sellerId: string;
  orderId: string;
  total: number;
}): Promise<void> {
  if (import.meta.env.DEV) {
    console.info("[notifications] Seller notification →", payload);
  }
  // TODO: call supabase.functions.invoke("notify-seller", { body: payload })
}

/**
 * Notify buyer when their order status changes.
 */
export async function notifyStatusChange(payload: {
  phone: string;
  orderId: string;
  newStatus: string;
}): Promise<void> {
  if (import.meta.env.DEV) {
    console.info("[notifications] Status change →", payload);
  }
  // TODO: call supabase.functions.invoke("notify-status-change", { body: payload })
}
