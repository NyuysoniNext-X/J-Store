import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Instagram, Twitter, Facebook, Youtube, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-navy text-navy-foreground mt-24">
      <div className="mx-auto max-w-[1536px] px-6 py-16 grid gap-10 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 md:col-span-2 space-y-4">
          <Logo />
          <p className="text-sm text-navy-foreground/70 max-w-sm">
            {t("footer.description")}
          </p>
          <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
            <MapPin className="h-4 w-4 text-gold" /> {t("footer.location")}
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
            title: "footer.shop",
            links: [
              ["footer.allProducts", "/shop"],
              ["footer.categories", "/shop"],
              ["footer.wishlist", "/wishlist"],
            ],
          },
          {
            title: "footer.sell",
            links: [
              ["footer.becomeSeller", "/seller/register"],
              ["footer.sellerDashboard", "/seller/dashboard"],
              ["footer.sellerAgreement", "/legal/seller-agreement"],
            ],
          },
          {
            title: "footer.deliver",
            links: [
              ["footer.deliverWithUs", "/delivery/apply"],
              ["footer.deliveryCompany", "/delivery/company"],
              ["footer.deliveryDashboard", "/delivery/dashboard"],
            ],
          },
          {
            title: "footer.support",
            links: [
              ["footer.helpCenter", "/help"],
              ["nav.trackOrder", "/orders"],
              ["footer.codPolicy", "/legal/cod-policy"],
              ["footer.contact", "/help"],
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold mb-4">{t(col.title)}</h4>
            <ul className="space-y-2 text-sm text-navy-foreground/70">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="hover:text-gold transition-colors">
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1536px] px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-navy-foreground/60">
          <p>{t("footer.tagline", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-6">
            <Link to="/legal/privacy" className="hover:text-gold">
              {t("footer.privacy")}
            </Link>
            <Link to="/legal/terms" className="hover:text-gold">
              {t("footer.terms")}
            </Link>
            <Link to="/legal/marketplace-rules" className="hover:text-gold">
              {t("footer.rules")}
            </Link>
            <span className="text-gold">MTN MoMo · Orange Money · Visa · Mastercard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
