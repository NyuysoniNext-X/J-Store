import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cleanPolicyContent } from "@/lib/policyUtils";

export const Route = createFileRoute("/legal/marketplace-rules")({
  component: MarketplaceRulesPage,
  head: () => ({ meta: [{ title: "Marketplace Rules — J-STORE.cm" }] }),
});

function MarketplaceRulesPage() {
  const { data: policy, isLoading } = useQuery({
    queryKey: ["policy", "marketplace_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("type", "marketplace_rules")
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
          <BookOpen className="h-7 w-7" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {policy?.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Version {policy?.version} • Effective{" "}
            {new Date(policy?.effective_date || "").toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="policy-content space-y-6 text-foreground/90 leading-relaxed whitespace-pre-wrap">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold mt-8 mb-4 text-foreground">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-semibold mt-6 mb-3 text-foreground">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
            ),
            p: ({ children }) => <p className="mb-4 text-base leading-7">{children}</p>,
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-2 mb-4 ml-4">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-2 mb-4 ml-4">{children}</ol>
            ),
            li: ({ children }) => <li className="text-base leading-7 ml-2">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-gold hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gold pl-4 italic text-muted-foreground my-4">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ),
          }}
        >
          {cleanPolicyContent(policy?.content || "")}
        </ReactMarkdown>
      </div>

      <div className="mt-12 p-6 bg-gradient-to-br from-secondary to-secondary/50 rounded-2xl border border-border/50">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-gold mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-1">Questions or Concerns?</p>
            <p className="text-sm text-muted-foreground">
              Last updated: {new Date(policy?.updated_at || "").toLocaleDateString()}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              For questions about marketplace rules, contact us at{" "}
              <a href="mailto:support@j-store.cm" className="text-gold hover:underline font-medium">
                support@j-store.cm
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
