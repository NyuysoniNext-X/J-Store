import {
  Shirt,
  Smartphone,
  Backpack,
  Home,
  Sparkles,
  ShoppingBag,
  Gift,
  type LucideIcon,
} from "lucide-react";
import nocturna from "@/assets/hats/nocturna.jpeg";
import collection from "@/assets/hats/collection.jpeg";
import dubaiAbuDhabi from "@/assets/hats/dubai-abudhabi.jpeg";
import uae from "@/assets/hats/uae.jpeg";
import martyrsDay from "@/assets/hats/martyrs-day.jpeg";
import camo86 from "@/assets/hats/86-camo.jpeg";
import squad from "@/assets/hats/squad.jpeg";
import fortune from "@/assets/hats/fortune.jpeg";
import savage from "@/assets/hats/savage.jpeg";
import bornWild from "@/assets/hats/born-to-be-wild.jpeg";

export type Product = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  category: string;
  seller: string;
  image: string; // gradient hue token (fallback)
  imageSrc?: string; // real product image url
  badge?: "new" | "hot" | "sale";
  description: string;
};

const hues = [25, 45, 200, 220, 260, 320, 10, 45, 45, 340];
const img = (i: number) => `hsl(${hues[i % hues.length]} 60% 55%)`;

const names = [
  "Ankara Linen Shirt",
  "Wireless Pulse Earbuds",
  "Leather Crossbody Bag",
  "Smart Fitness Watch",
  "Suede Chelsea Boots",
  "Cocoa Body Butter",
  "Bamboo Sunglasses",
  "Kente Throw Blanket",
  "Espresso Maker Pro",
  "Linen Maxi Dress",
  "Solar Power Bank",
  "Handwoven Raffia Hat",
  "Minimalist Sneakers",
  "Ceramic Pour-Over Set",
  "Silk Head Wrap",
  "Noise-Cancelling Headphones",
  "Beaded Statement Necklace",
  "Olive Wood Cutting Board",
  "Sport Performance Tee",
  "Rattan Pendant Lamp",
];

const categories = ["Fashion", "Electronics", "Home", "Beauty", "Sports", "Accessories"];
const sellers = [
  "Douala Threads",
  "Sahel Tech",
  "Mboa Home",
  "Wouri Beauty",
  "Atlas Athletics",
  "Goldline",
];

export const PRODUCTS: Product[] = names.map((name, i) => ({
  id: `p${i + 1}`,
  name,
  price: 9_500 + ((i * 1373) % 80_000),
  oldPrice: i % 3 === 0 ? 14_500 + ((i * 1373) % 80_000) : undefined,
  rating: 4 + (i % 10) / 10,
  reviews: 12 + ((i * 7) % 480),
  category: categories[i % categories.length],
  seller: sellers[i % sellers.length],
  image: img(i),
  badge: i % 5 === 0 ? "hot" : i % 7 === 0 ? "new" : i % 4 === 0 ? "sale" : undefined,
  description:
    "Premium quality, locally curated and shipped from Douala. Crafted with attention to detail for the modern African lifestyle.",
}));

const JUVANI_HATS: Array<
  Omit<Product, "id" | "category" | "seller" | "image"> & { imageSrc: string }
> = [
  {
    name: "Juvani Nocturna Trucker Cap",
    price: 18_500,
    oldPrice: 24_000,
    rating: 4.8,
    reviews: 142,
    imageSrc: nocturna,
    badge: "hot",
    description:
      "Distressed white brim, embroidered Nocturna patch, sky-blue mesh back. Signature Juvani street style.",
  },
  {
    name: "Juvani Signature Trucker Collection",
    price: 17_000,
    rating: 4.7,
    reviews: 318,
    imageSrc: collection,
    badge: "new",
    description:
      "From Squad to Commander — a full lineup of bold patch trucker caps from the Juvani signature drop.",
  },
  {
    name: "Juvani Dubai & Abu Dhabi Edition",
    price: 19_500,
    oldPrice: 25_000,
    rating: 4.9,
    reviews: 96,
    imageSrc: dubaiAbuDhabi,
    badge: "sale",
    description:
      "Pair of city-themed Juvani caps celebrating Dubai and Abu Dhabi with vivid red graffiti patches.",
  },
  {
    name: "Juvani UAE Forces Cap",
    price: 21_000,
    rating: 4.9,
    reviews: 210,
    imageSrc: uae,
    badge: "hot",
    description:
      "Olive crown with desert camo brim and UAE flag patch — limited national pride edition.",
  },
  {
    name: "Juvani Martyr's Day 30 Cap",
    price: 22_000,
    rating: 5.0,
    reviews: 88,
    imageSrc: martyrsDay,
    description:
      "Desert digital camo cap honoring UAE Martyr's Day — premium embroidered tribute patch.",
  },
  {
    name: "Juvani 86 Camo Trucker",
    price: 18_000,
    rating: 4.6,
    reviews: 174,
    imageSrc: camo86,
    badge: "new",
    description:
      "White crown, shield 86 patch, multicolor camo brim and sky mesh back. Bold and unmistakable.",
  },
  {
    name: "Juvani Squad Patch Cap",
    price: 16_500,
    rating: 4.7,
    reviews: 256,
    imageSrc: squad,
    description:
      "Stone-grey crown with mint mesh and signature Squad patch. Everyday Juvani essential.",
  },
  {
    name: "Juvani The Good Fortune Cap",
    price: 17_500,
    oldPrice: 22_000,
    rating: 4.8,
    reviews: 134,
    imageSrc: fortune,
    badge: "sale",
    description:
      "Forest green crown, red brim with embroidered Juvani script, black mesh. Luck on lock.",
  },
  {
    name: "Juvani Savage Neon Trio Cap",
    price: 15_000,
    rating: 4.5,
    reviews: 402,
    imageSrc: savage,
    badge: "hot",
    description:
      "Neon yellow, lime and orange Savage caps — designed to be seen from a block away.",
  },
  {
    name: "Juvani Born To Be Wild Cap",
    price: 19_000,
    rating: 4.7,
    reviews: 117,
    imageSrc: bornWild,
    badge: "new",
    description:
      "Grey crown, neon orange mesh and distressed black brim with vintage Born To Be Wild patch.",
  },
];

JUVANI_HATS.forEach((h, i) => {
  PRODUCTS.push({
    id: `juvani-${i + 1}`,
    category: "Fashion",
    seller: "Juvani",
    image: "hsl(25 60% 55%)",
    ...h,
  });
});

const SCHOOL_ITEMS: Array<Omit<Product, "id" | "category" | "seller" | "image">> = [
  {
    name: "Cahier 200 pages — Pack de 10",
    price: 6_500,
    oldPrice: 8_000,
    rating: 4.8,
    reviews: 412,
    badge: "sale",
    description:
      "Cahiers grand format 200 pages, couverture rigide. Idéal pour le collège et le lycée.",
  },
  {
    name: "Sac à dos scolaire renforcé",
    price: 18_500,
    oldPrice: 25_000,
    rating: 4.7,
    reviews: 286,
    badge: "hot",
    description:
      "Sac à dos ergonomique avec compartiment laptop, bretelles rembourrées et tissu imperméable.",
  },
  {
    name: "Trousse complète 42 pièces",
    price: 7_900,
    rating: 4.6,
    reviews: 198,
    badge: "new",
    description:
      "Trousse garnie : stylos, crayons, gomme, taille-crayon, règle, surligneurs. Prête pour la rentrée.",
  },
  {
    name: "Calculatrice scientifique 240 fonctions",
    price: 12_500,
    rating: 4.9,
    reviews: 521,
    description:
      "Calculatrice scientifique conforme au programme du Cameroun. Double alimentation solaire + pile.",
  },
  {
    name: "Set de géométrie premium",
    price: 4_500,
    rating: 4.5,
    reviews: 142,
    description: "Équerre, règle 30 cm, rapporteur, compas en métal — pochette zippée incluse.",
  },
  {
    name: "Uniforme scolaire kaki (collège)",
    price: 14_000,
    oldPrice: 18_000,
    rating: 4.6,
    reviews: 89,
    badge: "sale",
    description:
      "Chemise + pantalon en coton-polyester résistant. Tailles enfant et adolescent disponibles.",
  },
  {
    name: "Boîte de stylos Bic — Lot de 50",
    price: 5_900,
    rating: 4.7,
    reviews: 318,
    description:
      "50 stylos à bille (bleu, noir, rouge, vert). Indispensable pour toute l'année scolaire.",
  },
  {
    name: "Manuel de mathématiques — 3ème",
    price: 9_500,
    rating: 4.8,
    reviews: 174,
    description: "Programme officiel MINEDUB. Cours, exercices corrigés et préparation au BEPC.",
  },
  {
    name: "Tablette éducative pour enfants",
    price: 65_000,
    oldPrice: 85_000,
    rating: 4.5,
    reviews: 67,
    badge: "hot",
    description:
      'Tablette 7" avec contrôle parental, contenu éducatif pré-installé et étui antichoc.',
  },
  {
    name: "Cartable à roulettes primaire",
    price: 22_000,
    rating: 4.7,
    reviews: 156,
    badge: "new",
    description: "Cartable à roulettes pour enfants du primaire — léger, robuste, motifs colorés.",
  },
  {
    name: "Lot de 6 cahiers de travaux pratiques",
    price: 8_500,
    rating: 4.6,
    reviews: 92,
    description:
      "Cahiers TP avec pages quadrillées et pages blanches alternées. Pour SVT, physique et chimie.",
  },
  {
    name: "Lampe de bureau LED rechargeable",
    price: 11_500,
    rating: 4.8,
    reviews: 243,
    description:
      "Lampe LED anti-éblouissement, batterie 8h. Parfaite pour les devoirs et révisions.",
  },
];

const schoolHues = [25, 200, 45, 320, 45, 220, 10, 45, 260, 340, 0, 45];
SCHOOL_ITEMS.forEach((s, i) => {
  PRODUCTS.push({
    id: `school-${i + 1}`,
    category: "School",
    seller: i % 2 === 0 ? "Librairie Mboa" : "EduCam Supplies",
    image: `hsl(${schoolHues[i % schoolHues.length]} 60% 55%)`,
    ...s,
  });
});

export const CATEGORIES = [
  { slug: "fashion", name: "Fashion", icon: Shirt },
  { slug: "electronics", name: "Electronics", icon: Smartphone },
  { slug: "school", name: "School", icon: Backpack },
  { slug: "home", name: "Home & Living", icon: Home },
  { slug: "beauty", name: "Beauty", icon: Sparkles },
  { slug: "sports", name: "Sports", icon: ShoppingBag },
  { slug: "accessories", name: "Accessories", icon: Gift },
];

export const formatXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type Review = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  comment: string;
  date: string; // ISO date string
};

const REVIEW_AUTHORS = [
  "Amina D.",
  "Jean P.",
  "Brice K.",
  "Sandrine M.",
  "Achille N.",
  "Larissa F.",
  "Michel T.",
  "Aïcha B.",
  "Yannick E.",
  "Carine L.",
  "Serge M.",
  "Priscille K.",
];

const REVIEW_COMMENTS = [
  "Exactly as described, fast delivery in Douala!",
  "Good quality for the price, would buy again.",
  "Packaging could be better but the product itself is great.",
  "Seller was responsive and shipped the same day.",
  "Better than I expected — really happy with this purchase.",
  "Solid product, matches the photos on the listing.",
  "Took a couple extra days but arrived in perfect condition.",
  "My second time ordering from this seller, always reliable.",
];

/** Generate 3 deterministic reviews per product seeded off the product index. */
function reviewsFor(product: Product, index: number): Review[] {
  return [0, 1, 2].map((n) => {
    const seed = index * 3 + n;
    // Introduce a ±1 jitter so not all reviews are identical stars
    const jitter = [0, -1, 0][n];
    return {
      id: `${product.id}-r${n + 1}`,
      productId: product.id,
      author: REVIEW_AUTHORS[seed % REVIEW_AUTHORS.length],
      rating: Math.max(3, Math.min(5, Math.round(product.rating) + jitter)),
      comment: REVIEW_COMMENTS[seed % REVIEW_COMMENTS.length],
      date: new Date(2026, 5, 10 + ((seed * 3) % 28)).toISOString(),
    };
  });
}

export const REVIEWS: Review[] = PRODUCTS.flatMap((p, i) => reviewsFor(p, i));

export const getReviews = (productId: string): Review[] =>
  REVIEWS.filter((r) => r.productId === productId);
