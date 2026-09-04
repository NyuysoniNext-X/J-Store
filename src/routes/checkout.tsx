import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronRight, Lock, Loader2, ShieldCheck } from "lucide-react";
import useCartDetailed, { useCart, useCartSubtotal } from "@/lib/store";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type PaymentMethod = "mesomb" | "flutterwave" | "cod";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; description: string }[] = [
  { id: "mesomb", label: "MTN / Orange Money", description: "Pay via MeSomb" },
  { id: "flutterwave", label: "Card", description: "Visa / Mastercard via Flutterwave" },
  { id: "cod", label: "Cash on delivery", description: "Pay when it arrives" },
];

function CheckoutPage() {
  const items = useCartDetailed();
  const subtotal = useCartSubtotal();
  const clear = useCart((s) => s.clear);
  /*const { user } = useAuth();*/
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Douala");
  const [zoneIdx, setZoneIdx] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("mesomb");
  const [payRef, setPayRef] = useState("");
  const [placing, setPlacing] = useState(false);

  const cityZones = getCity(city);
  const baseFee = cityZones.tiers[zoneIdx]?.fee ?? 0;
  const shipping = subtotal >= FREE_DELIVERY_THRESHOLD && cityZones.managed ? 0 : baseFee;
  const total = subtotal + shipping;

  const canSubmit =
    fullName.trim() &&
    phone.trim() &&
    address.trim() &&
    items.length > 0 &&
    (method === "cod" || payRef.trim());

  async function placeOrder() {
    if (!canSubmit) return;
    setPlacing(true);
    const orderId = "JS-" + Date.now().toString().slice(-8);
    // TODO(Phase 4): replace with a real order_groups -> orders -> order_items
    // insert via queries.ts once checkout writes are wired up. For now this
    // just clears the cart and routes to the confirmation screen.
    clear();
    setPlacing(false);
    nav({ to: "/order-success", search: { orderId, total } });
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
              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${i <= step ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${i === step ? "text-foreground" : "text-muted-foreground"}`}
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
          {/* Step 0 — Shipping */}
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

          {/* Step 1 — Delivery method (summary + confirmation) */}
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

          {/* Step 2 — Payment */}
          {step === 2 && (
            <>
              <h2 className="font-display text-xl font-semibold">Payment</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMethod(m.id);
                      setPayRef("");
                    }}
                    className={`p-4 border-2 rounded-xl text-left transition-colors ${method === m.id ? "border-gold bg-gold/5" : "border-border hover:border-gold/50"}`}
                  >
                    <PayBadge id={m.id} />
                    <p className="text-sm font-semibold mt-2">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </button>
                ))}
              </div>

              <div className="mt-2">
                {method === "cod" ? (
                  <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    Pay in cash when your order arrives. Available in selected zones.
                  </p>
                ) : (
                  <Input
                    placeholder="Phone number (+237 6XX XXX XXX)"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                  />
                )}
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Lock className="h-3.5 w-3.5" />
                Funds held in escrow until you confirm delivery.
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
                disabled={!canSubmit || placing}
                onClick={placeOrder}
              >
                {placing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
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
            {items.map(({ product, qty }) => {
              return (
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
              );
            })}
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

function PayBadge({ id }: { id: PaymentMethod }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide">{id.replaceAll("_", " ")}</span>
  );
}
