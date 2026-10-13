import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import useCartDetailed, { useCart, useCartSubtotal } from "@/lib/store";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart — J-STORE.cm" }] }),
});

function CartPage() {
  const { t } = useI18n();
  const items = useCartDetailed();
  const subtotal = useCartSubtotal();
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const shipping = subtotal > 50000 || subtotal === 0 ? 0 : 2500;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center py-24 px-6">
        <ShoppingBag className="h-16 w-16 text-gold mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold">{t("cart.empty")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("cart.discover")}
        </p>
        <Button
          asChild
          className="mt-6 rounded-full h-12 px-7 bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/shop">{t("cart.startShopping")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
        {t("cart.title")} ({items.length})
      </h1>
      <div className="grid lg:grid-cols-[1fr_400px] gap-10">
        <div className="space-y-4">
          {items.map(({ product, qty }) => (
            <div
              key={product.id}
              className="flex flex-wrap sm:flex-nowrap gap-4 p-4 bg-card border border-border rounded-2xl"
            >
              <div
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl flex-shrink-0"
                style={
                  product.imageSrc
                    ? undefined
                    : {
                        background: `linear-gradient(135deg, ${product.image}, color-mix(in oklab, ${product.image} 60%, black))`,
                      }
                }
              >
                {product.imageSrc && (
                  <img
                    src={product.imageSrc}
                    alt={product.name}
                    className="h-full w-full object-cover rounded-xl"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {product.seller}
                </p>
                <Link
                  to="/product/$id"
                  params={{ id: product.id }}
                  className="font-medium hover:text-gold transition-colors line-clamp-2 sm:line-clamp-1"
                >
                  {product.name}
                </Link>
                <p className="font-display font-semibold mt-1">{formatXAF(product.price)}</p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto sm:justify-between gap-2">
                <button
                  onClick={() => remove(product.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t("cart.remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center border border-border rounded-full">
                  <button
                    onClick={() => setQty(product.id, qty - 1)}
                    className="h-8 w-8 flex items-center justify-center"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{qty}</span>
                  <button
                    onClick={() => setQty(product.id, qty + 1)}
                    className="h-8 w-8 flex items-center justify-center"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="bg-card border border-border rounded-2xl p-6 h-fit lg:sticky lg:top-32 space-y-4">
          <h3 className="font-display text-xl font-semibold">{t("cart.orderSummary")}</h3>
          <div className="space-y-2 text-sm">
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
          </div>
          <div className="pt-4 border-t border-border flex justify-between font-display text-lg font-bold">
            <span>{t("cart.total")}</span>
            <span>{formatXAF(total)}</span>
          </div>
          <div className="pt-2">
            <div className="flex gap-2">
              <input
                placeholder={t("cart.couponCode")}
                className="flex-1 h-10 rounded-full px-4 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
              />
              <Button variant="outline" className="rounded-full">
                {t("common.apply")}
              </Button>
            </div>
          </div>
          <Button
            asChild
            className="w-full rounded-full h-12 bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Link to="/checkout">{t("cart.proceed")}</Link>
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            {t("cart.securePayment")}
          </p>
        </aside>
      </div>
    </div>
  );
}
