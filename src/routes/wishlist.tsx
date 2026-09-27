import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Loader2 } from "lucide-react";
import { useWishlist } from "@/lib/store";
import { useProducts } from "@/lib/queries";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () => ({ meta: [{ title: "Wishlist — J-STORE.cm" }] }),
});

function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const { data: allProducts = [], isLoading } = useProducts();
  const items = allProducts.filter((p) => ids.includes(p.id));

  if (isLoading) {
    return (
      <div className="mx-auto max-w-384 px-6 py-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">Your wishlist</h1>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">Your wishlist</h1>
      {items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Heart className="h-12 w-12 text-gold mx-auto mb-4" />
          <p className="font-display text-xl">No saved items yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tap the heart on any product to save it for later.
          </p>
          <Button
            asChild
            className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
          >
            <Link to="/shop">Explore products</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
