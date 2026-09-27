import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  Lock,
  Loader2,
  ShieldCheck,
  Phone,
  Copy,
  Clock,
  AlertCircle,
} from "lucide-react";
import useCartDetailed, { useCart, useCartSubtotal } from "@/lib/store";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PLATFORM_MOMO } from "@/lib/types";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — J-STORE.cm" }] }),
});

const STEPS = ["Shipping", "Delivery", "Payment"];

const DELIVERY_ZONES = [
  {
    city: "Douala",
    managed: true,
    tiers: [
      { name: "Centre (Akwa, Bonanjo, Deido)", fee: 1000, time: "2–4 hours" },
      { name: "Extended (Makepe, Bepanda, Bonaberi)", fee: 1500, time: "4–6 hours" },
    ],
  },
  {
    city: "Yaoundé",
    managed: true,
    tiers: [
      { name: "Centre (Bastos, Mvog-Mbi)", fee: 1500, time: "4–6 hours" },
      { name: "Extended (Obili, Efoulan)", fee: 2000, time: "6–8 hours" },
    ],
  },
  {
    city: "Buea",
    managed: true,
    tiers: [{ name: "City centre", fee: 1500, time: "Next day" }],
  },
  {
    city: "Other",
    managed: false,
    tiers: [{ name: "Seller-managed delivery", fee: 0, time: "Arranged with seller" }],
  },
] as const;

function getCity(city: string) {
  return DELIVERY_ZONES.find((z) => z.city === city) ?? DELIVERY_ZONES[DELIVERY_ZONES.length - 1];
}

const FREE_DELIVERY_THRESHOLD = 50_000;
const PLATFORM_FEE_PCT = 5;

type MomoProvider = "mtn" | "orange";

const MOMO_PROVIDERS: { id: MomoProvider; label: string; color: string }[] = [
  { id: "mtn", label: "MTN MoMo", color: "border-yellow-400 bg-yellow-400/5" },
  { id: "orange", label: "Orange Money", color: "border-orange-400 bg-orange-400/5" },
];

function CheckoutPage() {
  const items = useCartDetailed();
  const subtotal = useCartSubtotal();
  const clear = useCart((s) => s.clear);
  const { user, isAuthenticated } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Douala");
  const [zoneIdx, setZoneIdx] = useState(0);
  const [momoProvider, setMomoProvider] = useState<MomoProvider>("mtn");
  const [transactionRef, setTransactionRef] = useState("");
  const [placing, setPlacing] = useState(false);

  const cityZones = getCity(city);
  const baseFee = cityZones.tiers[zoneIdx]?.fee ?? 0;
  const shipping = subtotal >= FREE_DELIVERY_THRESHOLD && cityZones.managed ? 0 : baseFee;
  const total = subtotal + shipping;
  const selectedMomo = PLATFORM_MOMO[momoProvider];

  const canSubmit =
    fullName.trim() && phone.trim() && address.trim() && items.length > 0 && transactionRef.trim();

  async function placeOrder() {
    if (!canSubmit) return;
    if (!isAuthenticated || !user) {
      toast.error("Please sign in to place an order.");
      nav({ to: "/login", search: { redirect: "/checkout" } });
      return;
    }

    setPlacing(true);
    try {
      const { data, error } = await supabase.rpc("place_order", {
        p_cart: items.map(({ product, qty }) => ({
          product_id: product.id,
          quantity: qty,
        })),
        p_shipping: {
          recipient_name: fullName,
          phone,
          city,
          quarter: cityZones.tiers[zoneIdx]?.name ?? city,
          landmark: address,
          delivery_fee: shipping,
        },
        p_payment_method: `${momoProvider}_momo`,
        p_transaction_ref: transactionRef.trim(),
      });

      if (error) throw error;
      if (!data) throw new Error("Order was not created");
      const result = data as unknown as { group_number: string; total: number };

      clear();
      nav({
        to: "/order-success",
        search: { orderId: result.group_number, total: result.total },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to place order";
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  }

  function copyNumber() {
    void navigator.clipboard.writeText(selectedMomo.number);
    toast.success(`${selectedMomo.provider} number copied!`);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center py-24 px-6">
        <h1 className="font-display text-2xl font-bold mb-3">Your cart is empty</h1>
        <Button
          asChild
          className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/shop">Browse products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Secure checkout</h1>
      <p className="text-muted-foreground mb-8">Complete your order in 3 steps</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 md:gap-4 mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 md:gap-4 flex-1">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                i <= step ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${i < step ? "bg-gold" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-10">
        {/* Form panel */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
          {/* ── Step 0 — Shipping ── */}
          {step === 0 && (
            <>
              <h2 className="font-display text-xl font-semibold">Delivery details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Full name <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Amina Diop"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Phone (WhatsApp) <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="6XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">
                    Address <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="Quarter, street, landmark…"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">City</label>
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setZoneIdx(0);
                    }}
                    className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                  >
                    {DELIVERY_ZONES.map((z) => (
                      <option key={z.city} value={z.city}>
                        {z.city}
                        {!z.managed ? " (seller delivery)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Delivery option</label>
                  <select
                    value={zoneIdx}
                    onChange={(e) => setZoneIdx(Number(e.target.value))}
                    className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                  >
                    {cityZones.tiers.map((t, i) => (
                      <option key={t.name} value={i}>
                        {t.name} — {t.time} ({t.fee === 0 ? "free" : formatXAF(t.fee)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── Step 1 — Confirm delivery ── */}
          {step === 1 && (
            <>
              <h2 className="font-display text-xl font-semibold">Confirm delivery</h2>
              <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Name:</span> <strong>{fullName}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> <strong>{phone}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Address:</span> {address}
                </p>
                <p>
                  <span className="text-muted-foreground">City / zone:</span> {city} —{" "}
                  {cityZones.tiers[zoneIdx]?.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Estimated:</span>{" "}
                  {cityZones.tiers[zoneIdx]?.time}
                </p>
                <p>
                  <span className="text-muted-foreground">Delivery fee:</span>{" "}
                  {shipping === 0 ? (
                    <span className="text-gold font-semibold">Free</span>
                  ) : (
                    formatXAF(shipping)
                  )}
                </p>
              </div>
              <button onClick={() => setStep(0)} className="text-xs text-gold hover:underline">
                ← Edit address
              </button>
            </>
          )}

          {/* ── Step 2 — Manual MoMo Payment ── */}
          {step === 2 && (
            <>
              <h2 className="font-display text-xl font-semibold">Payment</h2>

              {/* Provider selector */}
              <div>
                <p className="text-sm font-medium mb-3">Choose payment network</p>
                <div className="grid grid-cols-2 gap-3">
                  {MOMO_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMomoProvider(p.id)}
                      className={`border-2 rounded-xl p-4 text-left font-semibold text-sm transition-colors ${
                        momoProvider === p.id ? p.color : "border-border hover:border-gold/40"
                      }`}
                    >
                      <Phone className="h-5 w-5 mb-2 text-gold" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* How-to card */}
              <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
                <p className="text-sm font-semibold">
                  How to pay with {selectedMomo.label}
                </p>
                <ol className="text-sm space-y-3 text-muted-foreground list-none">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    Open your {selectedMomo.label} app or dial the USSD code on your phone.
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Transfer exactly{" "}
                      <strong className="text-foreground">{formatXAF(total)}</strong> to:
                      <span className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-base font-bold text-foreground">
                          {selectedMomo.number}
                        </span>
                        <button
                          onClick={copyNumber}
                          className="text-gold hover:text-gold/70 transition-colors"
                          aria-label="Copy number"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </span>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        Beneficiary: J-STORE.cm
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    Copy the transaction ID / reference number you receive and paste it below.
                  </li>
                </ol>

                {/* Transaction ref input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Transaction reference <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="e.g. TXN2026091600123456"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    The reference ID shown in your {selectedMomo.label} confirmation SMS.
                  </p>
                </div>
              </div>

              {/* Verification notice */}
              <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  After submitting, our team will verify your transaction within{" "}
                  <strong>3 hours</strong>. You'll receive a notification when your order is
                  confirmed.
                </p>
              </div>

              {!isAuthenticated && (
                <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    Please{" "}
                    <Link to="/login" search={{ redirect: "/checkout" }} className="underline font-medium">
                      sign in
                    </Link>{" "}
                    to place an order.
                  </p>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Lock className="h-3.5 w-3.5" />
                Your order is protected — payment held until delivery confirmed.
              </p>
            </>
          )}

          {/* Nav buttons */}
          <div className="flex justify-between pt-4 border-t border-border">
            {step > 0 ? (
              <Button variant="outline" className="rounded-full" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <Link
                to="/cart"
                className="text-sm text-muted-foreground hover:underline self-center"
              >
                ← Back to cart
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                className="rounded-full bg-navy text-navy-foreground hover:bg-navy/90"
                disabled={step === 0 && (!fullName.trim() || !phone.trim() || !address.trim())}
                onClick={() => setStep(step + 1)}
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="rounded-full bg-emerald text-emerald-foreground hover:bg-emerald/90 h-12 px-7"
                disabled={!canSubmit || placing || !isAuthenticated}
                onClick={placeOrder}
              >
                {placing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing order…
                  </>
                ) : (
                  <>Place order · {formatXAF(total)}</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Order summary */}
        <aside className="bg-card border border-border rounded-2xl p-6 h-fit lg:sticky lg:top-32 space-y-4">
          <h3 className="font-display text-lg font-semibold">Order summary</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {items.map(({ product, qty }) => (
              <div key={product.id} className="flex gap-3 text-sm">
                <div
                  className="h-12 w-12 rounded-lg shrink-0 overflow-hidden bg-muted"
                  style={
                    product.imageSrc
                      ? undefined
                      : {
                          background: `linear-gradient(135deg, ${product.image}, color-mix(in oklab, ${product.image} 60%, black))`,
                        }
                  }
                >
                  {product.imageSrc && (
                    <img src={product.imageSrc} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-1 font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">Qty {qty}</p>
                </div>
                <p className="font-medium shrink-0">{formatXAF(product.price * qty)}</p>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-border space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatXAF(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {shipping === 0 ? (
                  <span className="text-gold font-medium">Free</span>
                ) : (
                  formatXAF(shipping)
                )}
              </span>
            </div>
            <div className="flex justify-between font-display font-bold pt-2 border-t border-border text-base">
              <span>Total</span>
              <span>{formatXAF(total)}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            Escrow-protected · {PLATFORM_FEE_PCT}% platform fee
          </div>
        </aside>
      </div>
    </div>
  );
}
