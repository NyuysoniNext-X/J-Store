import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PolicyContent } from "@/components/legal/PolicyContent";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/legal/cod-policy")({
  component: CODPolicyPage,
  head: () => ({ meta: [{ title: "Cash on Delivery Policy — J-STORE.cm" }] }),
});

function CODPolicyPage() {
  const { lang, t } = useI18n();
  const { data: policy, isLoading } = useQuery({
    queryKey: ["policy", "cod_policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("type", "cod_policy")
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-gold to-gold/80 text-gold-foreground flex items-center justify-center shadow-lg">
          <Banknote className="h-7 w-7" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {policy?.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("policy.versionEffective", {
              version: policy?.version ?? "",
              date: new Date(policy?.effective_date || "").toLocaleDateString(
                lang === "fr" ? "fr-FR" : "en-US",
              ),
            })}
          </p>
        </div>
      </div>

      <PolicyContent content={policy?.content || ""} />

      <div className="mt-12 p-6 bg-gradient-to-br from-secondary to-secondary/50 rounded-2xl border border-border/50">
        <div className="flex items-start gap-3">
          <Banknote className="h-5 w-5 text-gold mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-1">{t("policy.codSupport")}</p>
            <p className="text-sm text-muted-foreground">
              {t("policy.lastUpdated")}{" "}
              {new Date(policy?.updated_at || "").toLocaleDateString(
                lang === "fr" ? "fr-FR" : "en-US",
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("policy.codContact")}{" "}
              <a href="mailto:cod@j-store.cm" className="text-gold hover:underline font-medium">
                cod@j-store.cm
              </a>{" "}
              or call +237 XXX XXX XXX
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
