import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Sparkles,
  Star,
  GraduationCap,
  BookOpen,
  Backpack,
  Calculator,
  Utensils,
  Smartphone,
  Laptop,
  Shirt,
  Home as HomeIcon,
  ShoppingBag,
  Gift,
} from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/shop/ProductCard";
import { buildBoostMap, fetchActiveBoosts, fetchBestSellerIds, fetchProducts } from "@/lib/queries";
import { BOOST_TIER_ORDER } from "@/lib/types";
import type { Product } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const [products, bestSellerIds, boosts] = await Promise.all([
      fetchProducts(),
      fetchBestSellerIds(),
      fetchActiveBoosts(),
    ]);
    return { products, bestSellerIds, boosts };
  },
  head: () => ({
    meta: [
      { title: "J-STORE.cm — Your Next Trusted Purchase" },
      {
        name: "description",
        content:
          "Discover premium products from verified Cameroonian sellers. Pay with MoMo, Orange Money or card. Shipped from Douala.",
      },
    ],
  }),
});

// Horizontal scrollable categories — icons replace emojis
const SCROLL_CATEGORIES = [
  { slug: "fashion", key: "category.fashion", icon: Shirt },
  { slug: "electronics", key: "category.electronics", icon: Smartphone },
  { slug: "school", key: "category.school", icon: GraduationCap },
  { slug: "home", key: "category.home", icon: HomeIcon },
  { slug: "beauty", key: "category.beauty", icon: Sparkles },
  { slug: "sports", key: "category.sports", icon: ShoppingBag },
  { slug: "accessories", key: "category.accessories", icon: Gift },
  { slug: "electronics", key: "category.phones", icon: Laptop },
  { slug: "home", key: "category.food", icon: Utensils },
] as const;

function Home() {
  const { t } = useI18n();
  const { products: PRODUCTS, bestSellerIds, boosts } = Route.useLoaderData();
  // PRODUCTS arrives newest-first, so the first 8 are the latest arrivals.
  // Featured = products from sellers with an active boost, highest tier first
  // (sponsored → top seller → featured). Hidden when nobody is boosted.
  const boostMap = buildBoostMap(boosts);
  const featured = PRODUCTS.filter((p) => boostMap.has(p.id))
    .sort((a, b) => BOOST_TIER_ORDER[boostMap.get(a.id)!] - BOOST_TIER_ORDER[boostMap.get(b.id)!])
    .slice(0, 8);
  const newArrivals = PRODUCTS.slice(0, 8);
  // Best sellers = real units sold (server-side), in sold order. Hidden until
  // at least 4 products have sales, rather than showing a fake/empty list.
  const bestSellers = bestSellerIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/70 via-secondary/20 to-transparent">
        <div className="mx-auto max-w-[1536px] px-6 pt-12 pb-16 md:pt-20 md:pb-28 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> {t("hero.eyebrow")}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              {t("hero.title")}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">{t("hero.sub")}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gold text-gold-foreground hover:bg-gold-600 hover:text-gold-foreground h-12 px-7"
              >
                <Link to="/shop">
                  {t("hero.cta")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full h-12 px-7 border-navy/20 hover:bg-secondary"
              >
                <Link to="/seller/register">{t("hero.cta2")}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 pt-4 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-gold" /> {t("home.verifiedSellers")}
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-gold" /> {t("home.sameDay")}
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-gold fill-gold" /> {t("home.customerRating")}
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-elegant">
              <img
                src={heroImg}
                alt={t("home.shoppingAlt")}
                className="w-full h-full object-cover"
                width={1536}
                height={1024}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/40 via-transparent to-transparent" />
            </div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute left-2 sm:-left-4 bottom-10 bg-card rounded-2xl shadow-elegant p-4 flex items-center gap-3 max-w-[200px] sm:max-w-[230px]"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center text-gold-foreground font-bold">
                <Star className="h-5 w-5 fill-current" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t("home.orderCount")}</p>
                <p className="text-xs text-muted-foreground">{t("home.deliveredThisMonth")}</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute right-2 sm:-right-4 top-10 bg-navy text-navy-foreground rounded-2xl shadow-gold p-4 max-w-[200px] sm:max-w-[220px]"
            >
              <p className="text-xs uppercase tracking-wider text-gold">{t("home.payYourWay")}</p>
              <p className="text-sm font-semibold mt-1">MoMo · Orange · Visa</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Categories: horizontal scrollable row ── */}
      <section className="mx-auto max-w-[1536px] px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl md:text-2xl font-bold">{t("home.shopByCategory")}</h2>
          <Link
            to="/shop"
            className="text-sm text-gold hover:underline flex items-center gap-1 shrink-0"
          >
            {t("home.viewAll")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {/* scrollbar hidden via inline style; Tailwind v4 doesn't expose scrollbar-width as utility */}
        <div
          className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {SCROLL_CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <Link
                key={`${cat.slug}-${i}`}
                to="/shop"
                search={{ category: cat.slug }}
                className="flex-shrink-0 w-24 sm:w-28 md:w-32 group snap-start"
              >
                <div className="flex flex-col items-center gap-2 bg-card border border-border rounded-2xl p-3 md:p-4 hover:shadow-elegant hover:border-gold/40 transition-all">
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-full bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 group-hover:scale-110 transition-all">
                    <Icon className="h-5 w-5 md:h-6 md:w-6 text-gold" strokeWidth={1.5} />
                  </div>
                  <span className="text-[11px] md:text-xs font-medium text-center leading-tight">
                    {t(cat.key)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {featured.length > 0 && (
        <ProductSection
          title={t("section.featured")}
          subtitle={t("home.featuredSubtitle")}
          products={featured}
        />
      )}

      <ProductSection
        title={t("section.new")}
        subtitle={t("home.newSubtitle")}
        products={newArrivals}
      />
      {bestSellers.length >= 4 && (
        <ProductSection
          title={t("section.best")}
          subtitle={t("home.bestSubtitle")}
          products={bestSellers}
        />
      )}

      {/* Testimonials */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="mx-auto max-w-[1536px] px-6 py-16">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-2">
              {t("home.lovedAcrossCameroon")}
            </p>
            <h2 className="font-display text-4xl font-bold">{t("home.trustedCommunity")}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Aïcha M.",
                city: "Douala",
                key: "home.testimonialFast",
              },
              {
                name: "Yannick K.",
                city: "Yaoundé",
                key: "home.testimonialMomo",
              },
              {
                name: "Linda T.",
                city: "Bafoussam",
                key: "home.testimonialSeller",
              },
            ].map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 shadow-elegant"
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-gold text-gold" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4">"{t(r.key)}"</p>
                <p className="text-sm font-semibold">
                  {r.name} <span className="font-normal text-muted-foreground">· {r.city}</span>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <h3 className="font-display text-3xl font-bold">{t("home.discountTitle")}</h3>
          <p className="text-muted-foreground mt-2">
            {t("home.newsletterIntro")}
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              className="flex-1 h-12 rounded-full px-5 bg-secondary border border-transparent focus:outline-none focus:border-gold"
            />
            <Button
              type="submit"
              className="rounded-full h-12 px-7 bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
            >
              {t("home.subscribe")}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

function ProductSection({
  title,
  subtitle,
  products,
  tint,
}: {
  title: string;
  subtitle: string;
  products: Product[];
  tint?: boolean;
}) {
  const { t } = useI18n();
  return (
    <section className={tint ? "bg-secondary/40 border-y border-border" : undefined}>
      <div className="mx-auto max-w-[1536px] px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">{title}</h2>
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Link
            to="/shop"
            className="text-sm font-medium text-gold hover:underline hidden md:inline-flex items-center gap-1"
          >
            {t("home.viewAll")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
        <Link
          to="/shop"
          className="text-sm font-medium text-gold hover:underline mt-5 inline-flex md:hidden items-center gap-1"
        >
          {t("home.viewAll")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
