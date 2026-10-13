import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useProducts } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

type ShopSearch = { q?: string };

export function SearchBox({
  className = "",
  inputClassName = "",
  onNavigate,
}: {
  className?: string;
  inputClassName?: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const currentSearch = useRouterState({ select: (s) => s.location.search as ShopSearch });
  const [value, setValue] = useState(currentSearch?.q ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: allProducts = [] } = useProducts();

  // Keep the box in sync if the URL's ?q= changes from elsewhere (back/forward nav).
  useEffect(() => {
    setValue(currentSearch?.q ?? "");
  }, [currentSearch?.q]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.seller.toLowerCase().includes(q),
    ).slice(0, 5);
  }, [value, allProducts]);

  function goToShop(q: string) {
    navigate({ to: "/shop", search: { q: q || undefined } });
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToShop(value.trim());
        }}
      >
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => value && setOpen(true)}
          placeholder={t("nav.search")}
          aria-label={t("nav.search")}
          className={`w-full pl-10 pr-9 h-11 rounded-full bg-secondary border border-transparent focus-visible:border-gold focus:outline-none text-sm ${inputClassName}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t("common.clearSearch")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-elegant overflow-hidden z-50">
          {suggestions.map((p) => (
            <Link
              key={p.id}
              to="/product/$id"
              params={{ id: p.id }}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors"
            >
              <div className="h-9 w-9 rounded-lg flex-shrink-0" style={{ background: p.image }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category} · {p.seller}
                </p>
              </div>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => goToShop(value.trim())}
            className="w-full text-left px-4 py-2.5 text-sm font-medium text-gold hover:bg-secondary transition-colors border-t border-border"
          >
            {t("common.seeAllResults")} "{value.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}
