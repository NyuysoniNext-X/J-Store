import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, Eye, Minus, Plus, Crown, Star, Megaphone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import { formatXAF, type Product } from "@/lib/mock-data";
import { useCart, useWishlist } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shop/StarRating";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BOOST_TIER_LABELS, type SellerBoostTier } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const BOOST_ICONS: Record<SellerBoostTier, React.ElementType | null> = {
  normal: null,
  featured: Star,
  top_seller: Crown,
  sponsored: Megaphone,
};

const BOOST_COLORS: Record<SellerBoostTier, string> = {
  normal: "",
  featured: "bg-blue-500 text-white",
  top_seller: "bg-gold text-gold-foreground",
  sponsored: "bg-purple-500 text-white",
};

export function ProductCard({
  product,
  index = 0,
  boostTier = "normal",
}: {
  product: Product;
  index?: number;
  boostTier?: SellerBoostTier;
}) {
  const { t } = useI18n();
  const add = useCart((s) => s.add);
  const toggleWish = useWishlist((s) => s.toggle);
  const wished = useWishlist((s) => s.ids.includes(product.id));
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [qty, setQty] = useState(1);

  const badgeColor =
    product.badge === "hot"
      ? "bg-destructive text-destructive-foreground"
      : product.badge === "new"
        ? "bg-gold text-gold-foreground"
        : product.badge === "sale"
          ? "bg-navy text-navy-foreground"
          : "";

  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  const BoostIcon = BOOST_ICONS[boostTier];
  const showBoost = boostTier !== "normal" && BoostIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.04 }}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:shadow-elegant transition-all duration-300 hover:-translate-y-1"
    >
      <Link to="/product/$id" params={{ id: product.id }} className="block">
        <div
          className="aspect-square relative overflow-hidden bg-muted"
          style={
            product.imageSrc
              ? undefined
              : {
                  background: `linear-gradient(135deg, ${product.image}, color-mix(in oklab, ${product.image} 60%, black))`,
                }
          }
        >
          {product.imageSrc ? (
            <img
              src={product.imageSrc}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-5xl text-white/30 group-hover:scale-110 transition-transform duration-500">
                {product.name.slice(0, 1)}
              </span>
            </div>
          )}
          {(product.badge || discount > 0 || showBoost) && (
            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
              {showBoost && BoostIcon && (
                <Badge
                  className={cn(
                    "uppercase tracking-wider text-[10px] gap-1",
                    BOOST_COLORS[boostTier],
                  )}
                >
                  <BoostIcon className="h-3 w-3" />
                  {boostTier === "featured"
                    ? t("product.featured")
                    : boostTier === "top_seller"
                      ? t("product.topSeller")
                      : t("product.sponsored")}
                </Badge>
              )}
              {product.badge && (
                <Badge className={cn("uppercase tracking-wider text-[10px]", badgeColor)}>
                  {product.badge === "hot"
                    ? t("product.badgeHot")
                    : product.badge === "new"
                      ? t("product.badgeNew")
                      : product.badge === "sale"
                        ? t("product.badgeSale")
                        : product.badge}
                </Badge>
              )}
              {discount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                  -{discount}%
                </Badge>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleWish(product.id);
              toast.success(
                wished ? t("product.removedFromWishlist") : t("product.addedToWishlist"),
              );
            }}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform"
            aria-label={t("product.wishlist")}
          >
            <Heart
              className={cn("h-4 w-4", wished ? "fill-destructive text-destructive" : "text-navy")}
            />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              setQty(1);
              setQuickViewOpen(true);
            }}
            className="absolute inset-x-3 bottom-3 h-10 rounded-full bg-navy/90 text-navy-foreground backdrop-blur flex items-center justify-center gap-2 text-sm font-medium opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0 transition-all duration-300"
          >
            <Eye className="h-4 w-4" /> {t("product.quickView")}
          </button>
        </div>
      </Link>
      <div className="p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {product.seller}
        </p>
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="font-medium line-clamp-1 hover:text-gold transition-colors"
        >
          {product.name}
        </Link>
        <div className="flex items-center gap-1 text-xs">
          <StarRating value={product.rating} size={14} />
          <span className="font-medium">{product.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">({product.reviews})</span>
        </div>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="font-display font-semibold">{formatXAF(product.price)}</p>
            {product.oldPrice && (
              <p className="text-xs text-muted-foreground line-through">
                {formatXAF(product.oldPrice)}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              add(product.id);
              toast.success(t("product.addedToCart"), { description: product.name });
            }}
            className="h-9 w-9 rounded-full bg-gold text-gold-foreground hover:bg-gold-600 hover:text-gold-foreground transition-colors flex items-center justify-center"
            aria-label={t("cart.add")}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl gap-0 grid-cols-1 sm:grid-cols-[1.3fr_1fr]">
          <div
            className="aspect-square sm:aspect-auto sm:flex-1 sm:min-h-full relative overflow-hidden bg-muted shrink-0"
            style={
              product.imageSrc
                ? undefined
                : {
                    background: `linear-gradient(135deg, ${product.image}, color-mix(in oklab, ${product.image} 60%, black))`,
                  }
            }
          >
            {product.imageSrc ? (
              <img
                src={product.imageSrc}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-6xl text-white/30">
                  {product.name.slice(0, 1)}
                </span>
              </div>
            )}
            {(product.badge || discount > 0 || showBoost) && (
              <div className="absolute top-4 left-4 flex flex-col gap-1 items-start">
                {showBoost && BoostIcon && (
                  <Badge
                    className={cn(
                      "uppercase tracking-wider text-[10px] gap-1",
                      BOOST_COLORS[boostTier],
                    )}
                  >
                    <BoostIcon className="h-3 w-3" />
                    {BOOST_TIER_LABELS[boostTier]}
                  </Badge>
                )}
                {product.badge && (
                  <Badge className={cn("uppercase tracking-wider text-[10px]", badgeColor)}>
                    {product.badge}
                  </Badge>
                )}
                {discount > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                    -{discount}%
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {product.seller}
            </p>
            <h2 className="font-display text-2xl font-semibold mt-1">{product.name}</h2>
            <div className="flex items-center gap-1 text-sm mt-2">
              <StarRating value={product.rating} size={16} />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({product.reviews} {t("product.reviews")})
              </span>
            </div>
            <div className="flex items-end gap-2 mt-3">
              <p className="font-display text-2xl font-semibold">{formatXAF(product.price)}</p>
              {product.oldPrice && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatXAF(product.oldPrice)}
                </p>
              )}
              {discount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground">-{discount}%</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4 line-clamp-4">{product.description}</p>

            <div className="flex items-center gap-3 mt-6">
              <div className="flex items-center border border-border rounded-full">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 flex items-center justify-center hover:bg-muted rounded-full"
                  aria-label={t("product.decreaseQuantity")}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="h-10 w-10 flex items-center justify-center hover:bg-muted rounded-full"
                  aria-label={t("product.increaseQuantity")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => {
                  add(product.id, qty);
                  toast.success(t("product.addedToCart"), {
                    description: `${qty} × ${product.name}`,
                  });
                  setQuickViewOpen(false);
                }}
                className="flex-1 h-10 rounded-full bg-gold text-gold-foreground hover:bg-gold/90 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <ShoppingCart className="h-4 w-4" /> {t("cart.add")}
              </button>
              <button
                onClick={() => {
                  toggleWish(product.id);
                  toast.success(
                    wished ? t("product.removedFromWishlist") : t("product.addedToWishlist"),
                  );
                }}
                className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-muted flex-shrink-0"
                aria-label={t("product.wishlist")}
              >
                <Heart
                  className={cn("h-4 w-4", wished ? "fill-destructive text-destructive" : "")}
                />
              </button>
            </div>

            <Link
              to="/product/$id"
              params={{ id: product.id }}
              onClick={() => setQuickViewOpen(false)}
              className="text-sm text-gold hover:underline mt-4 text-center"
            >
              {t("product.viewDetails")}
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
