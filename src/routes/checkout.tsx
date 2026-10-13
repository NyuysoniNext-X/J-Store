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
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — J-STORE.cm" }] }),
});

const STEPS = ["checkout.shippingStep", "checkout.deliveryStep", "checkout.paymentStep"];

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

function translateDeliveryValue(value: string, t: (key: string) => string) {
  const keyByValue: Record<string, string> = {
    "Centre (Akwa, Bonanjo, Deido)": "delivery.zoneDoualaCentre",
    "Extended (Makepe, Bepanda, Bonaberi)": "delivery.zoneDoualaExtended",
    "Centre (Bastos, Mvog-Mbi)": "delivery.zoneYaoundeCentre",
    "Extended (Obili, Efoulan)": "delivery.zoneYaoundeExtended",
    "City centre": "delivery.zoneCityCentre",
    "Seller-managed delivery": "delivery.zoneSellerManaged",
  };
  return keyByValue[value] ? t(keyByValue[value]) : value;
}

function translateDeliveryTime(value: string, t: (key: string) => string) {
  const keyByValue: Record<string, string> = {
    "2–4 hours": "delivery.time2to4",
    "4–6 hours": "delivery.time4to6",
    "6–8 hours": "delivery.time6to8",
    "Next day": "delivery.nextDay",
    "Arranged with seller": "delivery.arrangedSeller",
  };
  return keyByValue[value] ? t(keyByValue[value]) : value;
}

const FREE_DELIVERY_THRESHOLD = 50_000;
const PLATFORM_FEE_PCT = 5;

type MomoProvider = "mtn" | "orange";

const MOMO_PROVIDERS: { id: MomoProvider; label: string; color: string }[] = [
  { id: "mtn", label: "MTN MoMo", color: "border-yellow-400 bg-yellow-400/5" },
  { id: "orange", label: "Orange Money", color: "border-orange-400 bg-orange-400/5" },
];

function CheckoutPage() {
  const { t } = useI18n();
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
  // "instant" = MTN/Orange prompt via the payments API; "manual" = send money + enter reference.
  const [payMode, setPayMode] = useState<"instant" | "manual">("instant");
  const [payerPhone, setPayerPhone] = useState("");
  // Kept so a failed "pay now" retry reuses the same order instead of creating (and
  // reserving stock for) a second one.
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupProvider, setGroupProvider] = useState<MomoProvider | null>(null);

  const cityZones = getCity(city);
  const baseFee = cityZones.tiers[zoneIdx]?.fee ?? 0;
  const shipping = subtotal >= FREE_DELIVERY_THRESHOLD && cityZones.managed ? 0 : baseFee;
  const total = subtotal + shipping;
  const selectedMomo = PLATFORM_MOMO[momoProvider];

  const payerNumber = (payerPhone || phone).replace(/\D/g, "");
  // Cameroon mobile numbers are 9 digits starting with 6 (optionally prefixed by 237).
  // Looser while developing (npm run dev) so MTN sandbox test numbers still work.
  const payerFormatOk = import.meta.env.DEV
    ? payerNumber.length >= 9
    : /^(237)?6\d{8}$/.test(payerNumber);
  const payerOk = momoProvider === "orange" || payerFormatOk;
  const baseOk = fullName.trim() && phone.trim() && address.trim() && items.length > 0;
  const canSubmit = payMode === "manual" ? baseOk && transactionRef.trim() : baseOk && payerOk;

  async function placeOrder() {
    if (!canSubmit) return;
    if (!isAuthenticated || !user) {
      toast.error(t("checkout.signInRequired"));
      nav({ to: "/login", search: { redirect: "/checkout" } });
      return;
    }

    setPlacing(true);
    try {
      const instant = payMode === "instant";
      const activeProvider = groupProvider ?? momoProvider;
      const paymentMethod = activeProvider === "mtn" ? "mtn_momo" : "orange_money";
      let gid = instant ? groupId : null;
      let groupNumber = "";
      let groupTotal = total;

      if (!gid) {
        const { data, error } = await supabase.rpc("place_order", {
          p_cart: items.map(({ product, qty }) => ({ product_id: product.id, quantity: qty })),
          p_shipping: {
            recipient_name: fullName,
            phone,
            city,
            quarter: cityZones.tiers[zoneIdx]?.name ?? city,
            landmark: address,
            delivery_fee: shipping,
          },
          p_payment_method: paymentMethod,
          p_transaction_ref: instant ? undefined : transactionRef.trim(),
          p_flow: instant ? "api" : "manual",
        });
        if (error) throw error;
        if (!data) throw new Error(t("checkout.orderNotCreated"));
        const result = data as unknown as {
          order_group_id: string;
          group_number: string;
          total: number;
        };
        gid = result.order_group_id;
        groupNumber = result.group_number;
        groupTotal = result.total;
        if (instant) {
          setGroupId(gid);
          setGroupProvider(activeProvider);
        }
      }

      if (!instant) {
        clear();
        nav({ to: "/order-success", search: { orderId: groupNumber, total: groupTotal } });
        return;
      }

      const { data: pay, error: payErr } = await supabase.functions.invoke("payments/initiate", {
        body: { order_group_id: gid, provider: activeProvider, phone: payerNumber },
      });
      if (payErr) throw new Error(t("checkout.paymentStartError"));
      if (pay?.error) throw new Error(pay.error);

      // Cart is emptied on the confirmation page, once the money is confirmed.
      if (pay?.payment_url) {
        window.location.href = pay.payment_url; // Orange Money hosted payment page
        return;
      }
      nav({ to: "/payment-return", search: { group: gid } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("checkout.orderFailed");
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  }

  function copyNumber() {
    void navigator.clipboard.writeText(selectedMomo.number);
    toast.success(t("checkout.copiedNumber", { provider: selectedMomo.provider }));
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center py-24 px-6">
        <h1 className="font-display text-2xl font-bold mb-3">{t("cart.empty")}</h1>
        <Button
          asChild
          className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/shop">{t("checkout.browseProducts")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">{t("checkout.secure")}</h1>
      <p className="text-muted-foreground mb-8">{t("checkout.completeSteps")}</p>

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
              {t(s)}
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
              <h2 className="font-display text-xl font-semibold">{t("checkout.deliveryDetails")}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t("auth.fullName")} <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Amina Diop"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t("checkout.phoneWhatsapp")} <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="6XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">
                    {t("checkout.address")} <span className="text-gold">*</span>
                  </label>
                  <Input
                    placeholder="Quarter, street, landmark…"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("checkout.city")}</label>
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
                        {z.city === "Other" ? t("delivery.cityOther") : z.city}
                        {!z.managed ? ` (${t("checkout.sellerDelivery")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("checkout.deliveryOption")}</label>
                  <select
                    value={zoneIdx}
                    onChange={(e) => setZoneIdx(Number(e.target.value))}
                    className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                  >
                    {cityZones.tiers.map((tier, i) => (
                      <option key={tier.name} value={i}>
                        {translateDeliveryValue(tier.name, t)} —{" "}
                        {translateDeliveryTime(tier.time, t)} (
                        {tier.fee === 0 ? t("cart.free") : formatXAF(tier.fee)})
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
              <h2 className="font-display text-xl font-semibold">{t("checkout.confirmDelivery")}</h2>
              <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">{t("checkout.name")}</span>{" "}
                  <strong>{fullName}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">{t("checkout.phoneLabel")}</span>{" "}
                  <strong>{phone}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">{t("checkout.addressLabel")}</span>{" "}
                  {address}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("checkout.cityZone")}</span>{" "}
                  {city === "Other" ? t("delivery.cityOther") : city} —{" "}
                  {translateDeliveryValue(cityZones.tiers[zoneIdx]?.name ?? "", t)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("checkout.estimated")}</span>{" "}
                  {translateDeliveryTime(cityZones.tiers[zoneIdx]?.time ?? "", t)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("checkout.deliveryFee")}</span>{" "}
                  {shipping === 0 ? (
                    <span className="text-gold font-semibold">{t("cart.free")}</span>
                  ) : (
                    formatXAF(shipping)
                  )}
                </p>
              </div>
              <button onClick={() => setStep(0)} className="text-xs text-gold hover:underline">
                {t("checkout.editAddress")}
              </button>
            </>
          )}

          {/* ── Step 2 — Manual MoMo Payment ── */}
          {step === 2 && (
            <>
              <h2 className="font-display text-xl font-semibold">{t("checkout.paymentStep")}</h2>

              {/* Provider selector */}
              <div>
                <p className="text-sm font-medium mb-3">{t("checkout.chooseNetwork")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {MOMO_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      disabled={Boolean(groupId)}
                      onClick={() => setMomoProvider(p.id)}
                      className={`border-2 rounded-xl p-4 text-left font-semibold text-sm transition-colors ${
                        (groupProvider ?? momoProvider) === p.id
                          ? p.color
                          : "border-border hover:border-gold/40"
                      }`}
                    >
                      <Phone className="h-5 w-5 mb-2 text-gold" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pay mode */}
              <div>
                <p className="text-sm font-medium mb-3">{t("checkout.howPay")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["instant", "checkout.payInstantly", "checkout.approvePhone"],
                      ["manual", "checkout.sendManually", "checkout.transferEnterRef"],
                    ] as const
                  ).map(([id, title, sub]) => (
                    <button
                      key={id}
                      disabled={Boolean(groupId)}
                      onClick={() => setPayMode(id)}
                      className={`border-2 rounded-xl p-4 text-left text-sm transition-colors ${
                        payMode === id
                          ? "border-gold bg-gold/10"
                          : "border-border hover:border-gold/40"
                      }`}
                    >
                      <span className="font-semibold block">{t(title)}</span>
                      <span className="text-xs text-muted-foreground">{t(sub)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {payMode === "instant" && (
                <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
                  {momoProvider === "mtn" ? (
                    <>
                      <label className="text-sm font-medium">{t("checkout.mtnNumber")}</label>
                      <Input
                        inputMode="tel"
                        placeholder={phone || "6XX XXX XXX"}
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                      />
                      {!payerFormatOk && (payerPhone.trim() || phone.trim()) && (
                        <p className="text-xs text-destructive">
                          {t("checkout.validMtn")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("checkout.paymentRequest")}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("checkout.orangeRedirect")}
                    </p>
                  )}
                </div>
              )}

              {payMode === "manual" && (
                <>
                  {/* How-to card */}
                  <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
                    <p className="text-sm font-semibold">
                      {t("checkout.howToPay", { provider: selectedMomo.label })}
                    </p>
                    <ol className="text-sm space-y-3 text-muted-foreground list-none">
                      <li className="flex gap-3">
                        <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        {t("checkout.openProvider", { provider: selectedMomo.label })}
                      </li>
                      <li className="flex gap-3">
                        <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <span>
                          {t("checkout.transferAmount", { amount: formatXAF(total) })}{" "}
                          <span className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-base font-bold text-foreground">
                              {selectedMomo.number}
                            </span>
                            <button
                              onClick={copyNumber}
                              className="text-gold hover:text-gold/70 transition-colors"
                              aria-label={t("checkout.copyNumber")}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </span>
                          <span className="text-xs text-muted-foreground block mt-0.5">
                            {t("checkout.beneficiary")}
                          </span>
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <span className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          3
                        </span>
                        {t("checkout.transactionRefInstruction")}
                      </li>
                    </ol>

                    {/* Transaction ref input */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {t("checkout.transactionReference")} <span className="text-gold">*</span>
                      </label>
                      <Input
                        placeholder="e.g. TXN2026091600123456"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("checkout.referenceSms", { provider: selectedMomo.label })}
                      </p>
                    </div>
                  </div>

                  {/* Verification notice */}
                  <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-400">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>
                      {t("checkout.verificationTime")}
                    </p>
                  </div>
                </>
              )}

              {!isAuthenticated && (
                <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    {t("checkout.loginPrefix")}
                    <Link
                      to="/login"
                      search={{ redirect: "/checkout" }}
                      className="underline font-medium"
                    >
                      {t("auth.signIn")}
                    </Link>                    {t("checkout.loginSuffix")}
                  </p>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Lock className="h-3.5 w-3.5" />
                {t("checkout.protected")}
              </p>
            </>
          )}

          {/* Nav buttons */}
          <div className="flex justify-between pt-4 border-t border-border">
            {step > 0 ? (
              <Button variant="outline" className="rounded-full" onClick={() => setStep(step - 1)}>
                {t("checkout.back")}
              </Button>
            ) : (
              <Link
                to="/cart"
                className="text-sm text-muted-foreground hover:underline self-center"
              >
                {t("checkout.backToCart")}
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                className="rounded-full bg-navy text-navy-foreground hover:bg-navy/90"
                disabled={step === 0 && (!fullName.trim() || !phone.trim() || !address.trim())}
                onClick={() => setStep(step + 1)}
              >
                {t("checkout.continue")} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90 h-12 px-7"
                disabled={!canSubmit || placing || !isAuthenticated}
                onClick={placeOrder}
              >
                {placing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("checkout.placingOrder")}
                  </>
                ) : (
                  <>
                    {payMode === "instant" ? t("checkout.payNow") : t("checkout.placeOrder")} ·{" "}
                    {formatXAF(total)}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Order summary */}
        <aside className="bg-card border border-border rounded-2xl p-6 h-fit lg:sticky lg:top-32 space-y-4">
          <h3 className="font-display text-lg font-semibold">{t("cart.orderSummary")}</h3>
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
                  <p className="text-xs text-muted-foreground">
                    {t("checkout.quantity", { qty })}
                  </p>
                </div>
                <p className="font-medium shrink-0">{formatXAF(product.price * qty)}</p>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-border space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("cart.subtotal")}</span>
              <span>{formatXAF(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("cart.shipping")}</span>
              <span>
                {shipping === 0 ? (
                  <span className="text-gold font-medium">{t("cart.free")}</span>
                ) : (
                  formatXAF(shipping)
                )}
              </span>
            </div>
            <div className="flex justify-between font-display font-bold pt-2 border-t border-border text-base">
              <span>{t("cart.total")}</span>
              <span>{formatXAF(total)}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            {t("checkout.escrowProtected", { fee: PLATFORM_FEE_PCT })}
          </div>
        </aside>
      </div>
    </div>
  );
}
