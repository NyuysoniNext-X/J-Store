import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Instagram, Twitter, Facebook, Youtube, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-navy text-navy-foreground mt-24">
      <div className="mx-auto max-w-[1536px] px-6 py-16 grid gap-10 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 md:col-span-2 space-y-4">
          <Logo />
          <p className="text-sm text-navy-foreground/70 max-w-sm">
            J-STORE is Cameroon's premium multi-vendor marketplace. Discover, shop and ship from
            verified African sellers — secured by trusted local payments.
          </p>
          <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
            <MapPin className="h-4 w-4 text-gold" /> Douala, Cameroon
          </div>
          <div className="flex gap-3 pt-2">
            {[Instagram, Twitter, Facebook, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-gold hover:text-gold-foreground transition-colors flex items-center justify-center"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        {[
          {
            title: "Shop",
            links: [
              ["All products", "/shop"],
              ["Categories", "/shop"],
              ["Wishlist", "/wishlist"],
            ],
          },
          {
            title: "Sell",
            links: [
              ["Become a seller", "/seller/register"],
              ["Seller dashboard", "/seller/dashboard"],
              ["Resources", "/help"],
              ["Fees", "/help"],
            ],
          },
          {
            title: "Deliver",
            links: [
              ["Deliver with us", "/delivery/apply"],
              ["Delivery company", "/delivery/company"],
              ["Delivery dashboard", "/delivery/dashboard"],
              ["Requirements", "/help"],
            ],
          },
          {
            title: "Support",
            links: [
              ["Help center", "/help"],
              ["Track order", "/orders"],
              ["Returns", "/help"],
              ["Contact", "/help"],
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold mb-4">{col.title}</h4>
            <ul className="space-y-2 text-sm text-navy-foreground/70">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="hover:text-gold transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1536px] px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-navy-foreground/60">
          <p>© {new Date().getFullYear()} J-STORE.cm — Your Next Trusted Purchase</p>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-gold">
              Privacy
            </Link>
            <Link to="/" className="hover:text-gold">
              Terms
            </Link>
            <span className="text-gold">MTN MoMo · Orange Money · Visa · Mastercard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
