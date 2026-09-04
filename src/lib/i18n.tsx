import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "en" | "fr";
type Dict = Record<string, { en: string; fr: string }>;

const dict: Dict = {
  "nav.shop": { en: "Shop", fr: "Boutique" },
  "nav.categories": { en: "Categories", fr: "Catégories" },
  "nav.sell": { en: "Sell on J-STORE", fr: "Vendre sur J-STORE" },
  "nav.account": { en: "Account", fr: "Compte" },
  "nav.search": { en: "Search products, brands, sellers…", fr: "Rechercher produits, marques…" },
  "hero.eyebrow": {
    en: "Made in Africa · Shipped from Douala",
    fr: "Fait en Afrique · Expédié de Douala",
  },
  "hero.title": {
    en: "Your next trusted purchase, delivered.",
    fr: "Votre prochain achat de confiance, livré.",
  },
  "hero.sub": {
    en: "Discover thousands of premium products from verified African sellers. Pay with MoMo, Orange Money, or card.",
    fr: "Découvrez des milliers de produits premium de vendeurs africains vérifiés. Payez avec MoMo, Orange Money ou carte.",
  },
  "hero.cta": { en: "Start shopping", fr: "Commencer" },
  "hero.cta2": { en: "Become a seller", fr: "Devenir vendeur" },
  "section.featured": { en: "Featured", fr: "En vedette" },
  "section.trending": { en: "Trending now", fr: "Tendances" },
  "section.new": { en: "New arrivals", fr: "Nouveautés" },
  "section.best": { en: "Best sellers", fr: "Meilleures ventes" },
  "cart.add": { en: "Add to cart", fr: "Ajouter au panier" },
  "cart.buy": { en: "Buy now", fr: "Acheter" },
  "cart.empty": { en: "Your cart is empty", fr: "Votre panier est vide" },
  "cart.checkout": { en: "Checkout", fr: "Commander" },
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" &&
      localStorage.getItem("jstore.lang")) as Lang | null;
    if (stored) setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("jstore.lang", l);
  };
  const t = (k: string) => dict[k]?.[lang] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
