import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-navy px-6 py-2.5 text-sm font-medium text-navy-foreground hover:bg-gold hover:text-gold-foreground transition-colors"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-navy px-6 py-2.5 text-sm font-medium text-navy-foreground hover:bg-gold hover:text-gold-foreground transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "J-STORE.cm — Your Next Trusted Purchase" },
      {
        name: "description",
        content:
          "Cameroon's premium multi-vendor marketplace. Shop verified African sellers and pay with MoMo, Orange Money or card.",
      },
      { name: "theme-color", content: "#0f1d33" },
      { property: "og:title", content: "J-STORE.cm — Your Next Trusted Purchase" },
      {
        property: "og:description",
        content:
          "Cameroon's premium multi-vendor marketplace. Shop verified African sellers and pay with MoMo, Orange Money or card.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "J-STORE.cm — Your Next Trusted Purchase" },
      {
        name: "twitter:description",
        content:
          "Cameroon's premium multi-vendor marketplace. Shop verified African sellers and pay with MoMo, Orange Money or card.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/K8UxJGZOgob1m5sjonBYecfP4cz2/social-images/social-1779304380803-WhatsApp_Image_2026-05-20_at_6.11.44_PM.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/K8UxJGZOgob1m5sjonBYecfP4cz2/social-images/social-1779304380803-WhatsApp_Image_2026-05-20_at_6.11.44_PM.webp",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.jpg", type: "image/jpeg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthInvalidator />
            <div className="min-h-dvh flex flex-col">
              {!isAuthRoute && <Navbar />}
              <main className="flex-1">
                <Outlet />
              </main>
              {!isAuthRoute && <Footer />}
            </div>
            <Toaster position="top-right" richColors />
          </I18nProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthInvalidator() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}
