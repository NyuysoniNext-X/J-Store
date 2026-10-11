import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment-return")({
  validateSearch: (search: Record<string, unknown>) => ({
    group: typeof search.group === "string" ? search.group : "",
  }),
  component: PaymentReturn,
  head: () => ({ meta: [{ title: "Confirming payment — J-STORE.cm" }] }),
});

type PayStatus = {
  status?: "pending" | "successful" | "failed" | "expired" | "none";
  reason?: string | null;
  group_number?: string;
  total?: number;
  error?: string;
};

const POLL_MS = 3000;
const GIVE_UP_MS = 3 * 60 * 1000;

function PaymentReturn() {
  const { group } = Route.useSearch();
  const nav = useNavigate();
  const clear = useCart((s) => s.clear);
  const [state, setState] = useState<PayStatus>({ status: "pending" });
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  async function check() {
    if (!group || done.current) return;
    const { data, error } = await supabase.functions.invoke("payments/status", {
      body: { order_group_id: group },
    });
    if (error || !data) return; // transient — the next poll retries
    const res = data as PayStatus;
    if (res.error) {
      done.current = true;
      setState({ status: "failed", reason: res.error });
      return;
    }
    if (res.status === "successful") {
      done.current = true;
      clear(); // cart is only emptied once the money is actually confirmed
      nav({
        to: "/order-success",
        search: { orderId: res.group_number ?? "", total: res.total ?? 0 },
      });
      return;
    }
    if (res.status === "failed" || res.status === "expired") {
      done.current = true;
    }
    setState(res);
  }

  useEffect(() => {
    void check();
    const id = setInterval(() => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setTimedOut(true);
        clearInterval(id);
        return;
      }
      void check();
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const failed = state.status === "failed" || state.status === "expired";

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center space-y-5">
      {failed ? (
        <>
          <XCircle className="h-14 w-14 mx-auto text-destructive" />
          <h1 className="font-display text-2xl font-bold">Payment not completed</h1>
          <p className="text-sm text-muted-foreground">
            {state.reason ?? "The payment was cancelled or declined."} No money was taken, or any
            amount taken will be refunded by your provider. You can try again.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/checkout">Back to checkout</Link>
          </Button>
        </>
      ) : timedOut ? (
        <>
          <Clock className="h-14 w-14 mx-auto text-amber-500" />
          <h1 className="font-display text-2xl font-bold">Still waiting for confirmation</h1>
          <p className="text-sm text-muted-foreground">
            We have not received the confirmation yet. If you approved the payment on your phone,
            your order will be confirmed automatically in a few minutes. You can also check again.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              className="rounded-full"
              onClick={() => {
                startedAt.current = Date.now();
                setTimedOut(false);
                void check();
              }}
            >
              Check again
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/orders">My orders</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          {state.status === "successful" ? (
            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
          ) : (
            <Loader2 className="h-14 w-14 mx-auto animate-spin text-gold" />
          )}
          <h1 className="font-display text-2xl font-bold">Confirming your payment…</h1>
          <p className="text-sm text-muted-foreground">
            Check your phone and approve the payment request with your PIN. This page updates
            automatically — please don't close it.
          </p>
        </>
      )}
    </div>
  );
}
