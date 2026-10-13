import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, ShoppingCart, Truck, ShieldCheck, RotateCcw, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { formatXAF } from "@/lib/mock-data";
import { fetchProduct, useProducts, useReviews } from "@/lib/queries";
import { useCart, useWishlist } from "@/lib/store";
import { ProductCard } from "@/components/shop/ProductCard";
import { StarRating } from "@/components/shop/StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
  loader: async ({ params }) => {
    // Plain async fetcher shared with useProduct() in queries.ts — loaders
    // can't call hooks, so this stays a regular function, not useQuery.
    const p = await fetchProduct(params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Product"} — J-STORE.cm` },
      { name: "description", content: loaderData?.description ?? "" },
    ],
  }),
  notFoundComponent: ProductNotFound,
});

function ProductNotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md text-center py-20">
      <h1 className="font-display text-3xl font-bold">{t("product.notFound")}</h1>
      <Link to="/shop" className="text-gold mt-4 inline-block">
        {t("product.backToShop")}
      </Link>
    </div>
  );
}

function ProductPage() {
  const { lang, t } = useI18n();
  const product = Route.useLoaderData();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const add = useCart((s) => s.add);
  const toggleWish = useWishlist((s) => s.toggle);
  const wished = useWishlist((s) => s.ids.includes(product.id));
  const { data: sameCategoryProducts = [] } = useProducts({ category: product.category });
  const related = sameCategoryProducts.filter((p) => p.id !== product.id).slice(0, 4);
  const { data: reviews = [] } = useReviews(product.id);
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  // Reset to first thumbnail whenever the product changes (e.g. clicking a related item)
  useEffect(() => {
    setActiveImage(0);
  }, [product.id]);

  // Build 4 gallery views. Real photos get subtle crop/zoom variations per thumb;
  // gradient placeholders rotate the angle so thumbs look distinct.
  const views = useMemo(() => {
    if (product.imageSrc) {
      const crops = [
        { position: "center", scale: 1 },
        { position: "top", scale: 1.15 },
        { position: "right", scale: 1.1 },
        { position: "bottom", scale: 1.2 },
      ] as const;
      return crops.map((c) => ({ type: "photo" as const, ...c }));
    }
    return [0, 1, 2, 3].map((i) => ({ type: "gradient" as const, angle: 135 + i * 30 }));
  }, [product.imageSrc, product.id]);

  const current = views[activeImage];

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-8">
      <nav className="text-xs text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground">
          {t("common.home")}
        </Link>{" "}
        /{" "}
        <Link to="/shop" className="hover:text-foreground">
          {t("nav.shop")}
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-12">
        <div className="space-y-4">
          <motion.div
            key={activeImage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="aspect-square rounded-3xl overflow-hidden relative group bg-muted"
            style={
              current.type === "gradient"
                ? {
                    background: `linear-gradient(${current.angle}deg, ${product.image}, color-mix(in oklab, ${product.image} 50%, black))`,
                  }
                : undefined
            }
          >
            {current.type === "photo" ? (
              <img
                src={product.imageSrc}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500"
                style={{ objectPosition: current.position, transform: `scale(${current.scale})` }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-[200px] text-white/20">
                  {product.name.slice(0, 1)}
                </span>
              </div>
            )}
          </motion.div>
          <div className="grid grid-cols-4 gap-3">
            {views.map((v, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`aspect-square rounded-xl overflow-hidden border-2 bg-muted ${activeImage === i ? "border-gold" : "border-transparent"}`}
                style={
                  v.type === "gradient"
                    ? {
                        background: `linear-gradient(${v.angle}deg, ${product.image}, color-mix(in oklab, ${product.image} 50%, black))`,
                      }
                    : undefined
                }
              >
                {v.type === "photo" && (
                  <img
                    src={product.imageSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: v.position, transform: `scale(${v.scale})` }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold font-semibold mb-2">
              {product.seller}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">{product.name}</h1>
            <div className="flex items-center gap-3 mt-3 text-sm">
              <StarRating value={product.rating} size={16} />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                · {product.reviews} {t("product.reviews")}
              </span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <p className="font-display text-4xl font-bold">{formatXAF(product.price)}</p>
            {product.oldPrice && (
              <p className="text-lg text-muted-foreground line-through">
                {formatXAF(product.oldPrice)}
              </p>
            )}
            {discount > 0 && (
              <Badge className="bg-destructive text-destructive-foreground">-{discount}%</Badge>
            )}
          </div>

          <p className="text-muted-foreground leading-relaxed">{product.description}</p>

          <div className="flex items-center gap-4">
            <div className="flex items-center border border-border rounded-full">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="h-11 w-11 flex items-center justify-center hover:bg-muted rounded-l-full"
                aria-label={t("product.decreaseQuantity")}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-medium">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="h-11 w-11 flex items-center justify-center hover:bg-muted rounded-r-full"
                aria-label={t("product.increaseQuantity")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => toggleWish(product.id)}
              className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:border-gold transition-colors"
              aria-label={t("product.wishlist")}
            >
              <Heart className={wished ? "h-5 w-5 fill-destructive text-destructive" : "h-5 w-5"} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => {
                add(product.id, qty);
                toast.success(t("product.addedToCart"), {
                  description: `${qty} × ${product.name}`,
                });
              }}
              className="rounded-full h-12 px-7 flex-1 bg-navy text-navy-foreground hover:bg-navy/90"
            >
              <ShoppingCart className="mr-2 h-4 w-4" /> {t("cart.add")}
            </Button>
            <Button
              asChild
              className="rounded-full h-12 px-7 flex-1 bg-gold text-gold-foreground hover:bg-gold/90"
              onClick={() => add(product.id, qty)}
            >
              <Link to="/checkout">{t("cart.buy")}</Link>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
            {[
              { icon: Truck, key: "product.freeDelivery", sub: "product.ordersOver" },
              { icon: ShieldCheck, key: "product.buyerProtected", sub: "product.refundGuarantee" },
              { icon: RotateCcw, key: "product.returns", sub: "product.noHassle" },
            ].map((f, i) => (
              <div key={i} className="text-center">
                <f.icon className="h-5 w-5 text-gold mx-auto mb-1" />
                <p className="text-xs font-semibold">{t(f.key)}</p>
                <p className="text-[11px] text-muted-foreground">{t(f.sub)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-6">
            {t("product.customerReviews")} ({reviews.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.author}</span>
                  <StarRating value={r.rating} size={14} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(r.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-6">
            {t("product.youMayLike")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
