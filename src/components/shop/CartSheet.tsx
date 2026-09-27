import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { ReactNode, useMemo } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/store";
import { useProducts } from "@/lib/queries";
import { formatXAF, type Product } from "@/lib/mock-data";

export function CartSheet({ trigger }: { trigger: ReactNode }) {
  const rawItems = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { data: allProducts = [] } = useProducts();

  const items = useMemo(
    () =>
      rawItems
        .map((i) => {
          const product = allProducts.find((p) => p.id === i.id);
          return product ? { product, qty: i.qty } : null;
        })
        .filter(Boolean) as Array<{ product: Product; qty: number }>,
    [rawItems, allProducts],
  );
  const subtotal = useMemo(
    () => items.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
    [items],
  );
  const shipping = subtotal > 50000 || subtotal === 0 ? 0 : 2500;
  const total = subtotal + shipping;

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Your cart
            {items.length > 0 && (
              <Badge className="bg-gold text-gold-foreground ml-1">{items.length}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <ShoppingBag className="h-14 w-14 text-gold mb-3" />
            <p className="font-display text-lg font-semibold">Your cart is empty</p>
            <p className="text-sm text-muted-foreground mt-1">Add products to get started.</p>
            <SheetClose asChild>
              <Button
                asChild
                className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
              >
                <Link to="/shop">Browse shop</Link>
              </Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {items.map(({ product, qty }) => (
                <div
                  key={product.id}
                  className="flex gap-3 p-3 bg-card border border-border rounded-xl"
                >
                  <div
                    className="h-16 w-16 rounded-lg flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${product.image}, color-mix(in oklab, ${product.image} 60%, black))`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {product.seller}
                    </p>
                    <SheetClose asChild>
                      <Link
                        to="/product/$id"
                        params={{ id: product.id }}
                        className="text-sm font-medium hover:text-gold transition-colors line-clamp-1 block"
                      >
                        {product.name}
                      </Link>
                    </SheetClose>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center border border-border rounded-full">
                        <button
                          onClick={() => setQty(product.id, qty - 1)}
                          className="h-7 w-7 flex items-center justify-center"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-medium">{qty}</span>
                        <button
                          onClick={() => setQty(product.id, qty + 1)}
                          className="h-7 w-7 flex items-center justify-center"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="font-display text-sm font-semibold">
                        {formatXAF(product.price * qty)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(product.id)}
                    className="text-muted-foreground hover:text-destructive self-start"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-6 py-5 space-y-3 bg-card">
              <div className="space-y-1.5 text-sm">
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
                <div className="flex justify-between font-display text-base font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span>{formatXAF(total)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SheetClose asChild>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/cart">View cart</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    asChild
                    className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                  >
                    <Link to="/checkout">Checkout</Link>
                  </Button>
                </SheetClose>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
