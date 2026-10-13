import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  MessageSquare,
  Wallet,
  ArrowRight,
  Hand,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as React from "react";
import { useI18n } from "@/lib/i18n";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Search): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — J-STORE.cm" }] }),
});

const FEATURES = [
  { icon: ShieldCheck, key: "auth.escrowPayments" },
  { icon: MessageSquare, key: "auth.whatsappUpdates" },
  { icon: Wallet, key: "auth.mobileMoneyCheckout" },
];

function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const destination = (search.redirect as "/profile") ?? "/profile";

  // Email / password
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success(t("auth.welcome"));
      await navigate({ to: destination });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.signInFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/profile` },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-dvh flex items-start justify-center px-4 py-4 sm:items-center sm:py-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-border shadow-elegant flex flex-col sm:flex-row">
        {/* ── Left: navy branding ── */}
        <div className="hidden sm:flex sm:w-[40%] shrink-0 flex-col justify-between bg-navy p-8 text-navy-foreground">
          <div>
            <Logo className="[&_span]:text-white [&_.text-gold]:text-gold" />
            <div className="mt-12">
              <h2 className="font-display text-2xl font-bold leading-snug">
                {t("auth.welcomeBack")}{" "}
                <Hand className="inline h-5 w-5 text-gold align-[-0.1em]" />
              </h2>
              <p className="text-sm text-white/60 mt-2">
                {t("auth.signInIntro")}
              </p>
            </div>
            <ul className="mt-8 space-y-3">
              {FEATURES.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-center gap-2.5 text-sm text-white/80">
                  <Icon className="h-4 w-4 text-gold shrink-0" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-white/30 mt-12">
            © 2026 J-Store · Made in Cameroon <MapPin className="inline h-3 w-3 align-[-0.1em]" />
          </p>
        </div>

        {/* ── Right: form ── */}
        <div className="flex-1 bg-card p-6 sm:p-8 flex max-h-[calc(100dvh-2rem)] flex-col justify-center overflow-y-auto sm:max-h-none">
          <h1 className="font-display text-2xl font-bold">{t("auth.signIn")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("auth.newHere")}{" "}
            <Link
              to="/signup"
              search={{ ref: undefined }}
              className="text-gold font-medium hover:underline"
            >
              {t("auth.createAnAccount")}
            </Link>
          </p>

          {/* Google */}
          <Button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            variant="outline"
            className="w-full mt-6 rounded-xl h-11 hover:border-gold hover:bg-gold/5 transition-all"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#D9A62E"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {t("auth.continueGoogle")}
          </Button>

          <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            {t("auth.orEmail")}
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                {t("auth.email")}
              </label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                {t("auth.password")}
              </label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-xl h-11 bg-gold text-gold-foreground hover:bg-gold/90 font-semibold"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  {t("auth.signIn")} <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
