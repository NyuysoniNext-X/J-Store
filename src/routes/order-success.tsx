import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  ShieldCheck,
  Wallet,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { PLATFORM_FEE_PCT, DELIVERY_FEE_PCT } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/order-success")({
  component: SuccessPage,
  validateSearch: (s: Record<string, unknown>) => ({
    orderId:
      typeof s.orderId === "string"
        ? s.orderId
        : "JS-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    total: typeof s.total === "number" ? s.total : Number(s.total ?? 0),
  }),
  head: () => ({ meta: [{ title: "Order placed — J-STORE.cm" }] }),
});

const STEPS = [
  { icon: CheckCircle2, key: "order.paid" },
  { icon: Package, key: "order.preparing" },
  { icon: Truck, key: "order.shipped" },
  { icon: MapPin, key: "order.delivered" },
];

function SuccessPage() {
  const { t } = useI18n();
  const { orderId, total } = Route.useSearch();
  const sellerCut = total * (1 - (PLATFORM_FEE_PCT + DELIVERY_FEE_PCT) / 100);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="h-24 w-24 rounded-full bg-gradient-gold mx-auto flex items-center justify-center shadow-gold"
      >
        <Check className="h-12 w-12 text-gold-foreground" strokeWidth={3} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h1 className="font-display text-4xl font-bold mt-6">{t("order.confirmed")}</h1>
        <p className="text-muted-foreground mt-2">{t("order.confirmationDetails", { orderId })}</p>
      </motion.div>

      {/* Order details card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-8 bg-card border border-border rounded-2xl p-5 text-left space-y-2.5 text-sm"
      >
        <Row label={t("order.orderId")} value={orderId} />
        <Row label={t("order.amountPaid")} value={formatFCFA(total)} />
        <Row label={t("order.status")} value={t("order.heldEscrow")} highlight />
        <Row label={t("order.deliveryEta")} value={t("order.todayDouala")} />
      </motion.div>

      {/* Escrow breakdown */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-4 rounded-xl bg-secondary/60 p-4 text-xs text-muted-foreground text-left"
        >
          <p className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-gold" /> {t("order.escrowBreakdown")}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3 text-gold" /> {t("order.sellerReceives")}
              </span>
              <span className="font-medium text-foreground">{formatFCFA(sellerCut)}</span>
            </div>
            <div className="flex justify-between">
              <span>
                <ShieldCheck className="h-3 w-3 text-gold inline mr-1" />
                {t("order.platformFee")}
              </span>
              <span>{PLATFORM_FEE_PCT}%</span>
            </div>
            <div className="flex justify-between">
              <span>
                <Truck className="h-3 w-3 text-gold inline mr-1" />
                {t("order.deliveryFund")}
              </span>
              <span>{DELIVERY_FEE_PCT}%</span>
            </div>
          </div>
          <p className="mt-2">{t("order.paymentAutoRelease", { days: 7 })}</p>
        </motion.div>
      )}

      {/* Order timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex items-center justify-between"
      >
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center ${i === 0 ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}
              >
                <s.icon className="h-4 w-4" />
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}
              >
                {t(s.key)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 sm:w-12 mx-1 mb-4 ${i === 0 ? "bg-gold" : "bg-border"}`} />
            )}
          </div>
        ))}
      </motion.div>

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="flex flex-col sm:flex-row gap-3 mt-8 justify-center"
      >
        <Button
          asChild
          className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/orders">{t("order.track")}</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/shop">{t("order.continueShopping")}</Link>
        </Button>
      </motion.div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-amber-600" : ""}`}>{value}</span>
    </div>
  );
}
