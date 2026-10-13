import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, Loader2, Save, Eye, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PolicyContent } from "@/components/legal/PolicyContent";

export const Route = createFileRoute("/_authenticated/_super_admin/super-admin/policies")({
  component: PoliciesManagement,
  head: () => ({ meta: [{ title: "Manage Policies — J-STORE.cm" }] }),
});

const POLICY_TYPES = [
  { type: "terms_and_conditions", label: "Terms & Conditions", route: "/legal/terms" },
  { type: "privacy_policy", label: "Privacy Policy", route: "/legal/privacy" },
  { type: "seller_agreement", label: "Seller Agreement", route: "/legal/seller-agreement" },
  { type: "marketplace_rules", label: "Marketplace Rules", route: "/legal/marketplace-rules" },
  { type: "cod_policy", label: "COD Policy", route: "/legal/cod-policy" },
  { type: "return_policy", label: "Refund Policy", route: "/legal/return-policy" },
] as const;

type PolicyType = (typeof POLICY_TYPES)[number]["type"];

function PoliciesManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<PolicyType>("terms_and_conditions");
  const [previewMode, setPreviewMode] = useState(false);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["admin-policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("policies").select("*");
      if (error) throw error;
      return data;
    },
  });

  const currentPolicy = policies.find((p) => p.type === selectedType);
  const [formData, setFormData] = useState({
    title: currentPolicy?.title || "",
    content: currentPolicy?.content || "",
    version: currentPolicy?.version || "1.0",
    effective_date: currentPolicy?.effective_date || "",
  });

  useEffect(() => {
    if (currentPolicy) {
      setFormData({
        title: currentPolicy.title,
        content: currentPolicy.content,
        version: currentPolicy.version,
        effective_date: currentPolicy.effective_date,
      });
    }
  }, [currentPolicy]);

  const updatePolicy = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("policies")
        .update({
          ...data,
          updated_by: user!.id,
          updated_at: new Date().toISOString(),
        })
        .eq("type", selectedType);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("roles.policy_updated_successfully"));
      qc.invalidateQueries({ queryKey: ["admin-policies"] });
      qc.invalidateQueries({ queryKey: ["policy", selectedType] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1536px] px-6 py-20">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-gold text-gold-foreground flex items-center justify-center">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Super admin</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {t("roles.manage_policies")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update legal documents and platform agreements
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {POLICY_TYPES.map((pt) => (
            <button
              key={pt.type}
              onClick={() => {
                setSelectedType(pt.type);
                const policy = policies.find((p) => p.type === pt.type);
                if (policy) {
                  setFormData({
                    title: policy.title,
                    content: policy.content,
                    version: policy.version,
                    effective_date: policy.effective_date,
                  });
                }
                setPreviewMode(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                selectedType === pt.type
                  ? "bg-gold text-gold-foreground"
                  : "hover:bg-secondary text-muted-foreground"
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-semibold">{formData.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Version {formData.version} • Last updated:{" "}
                {new Date(currentPolicy?.updated_at || "").toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
                className="rounded-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? "Edit" : "Preview"}
              </Button>
              <Button
                size="sm"
                onClick={() => updatePolicy.mutate(formData)}
                disabled={updatePolicy.isPending || !currentPolicy}
                className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
              >
                {updatePolicy.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save changes
              </Button>
            </div>
          </div>

          {previewMode ? (
            <PolicyContent content={formData.content} />
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">{t("roles.policy_title")}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="version">{t("roles.version")}</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="mt-1.5"
                  placeholder={t("roles.e_g_1_0_2_1")}
                />
              </div>

              <div>
                <Label htmlFor="effective-date">{t("roles.effective_date")}</Label>
                <Input
                  id="effective-date"
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="content">{t("roles.content_markdown_supported")}</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={20}
                  className="mt-1.5 font-mono text-sm"
                  placeholder={t("roles.write_policy_content_in_markdown")}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use Markdown syntax: # Headings, **bold**, *italic*, - lists, etc.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-secondary rounded-2xl">
            <p className="text-sm text-muted-foreground">
              <Link2 className="inline h-3.5 w-3.5 mr-1 align-[-0.15em]" />
              Public URL:{" "}
              <a
                href={POLICY_TYPES.find((pt) => pt.type === selectedType)?.route}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                {window.location.origin}
                {POLICY_TYPES.find((pt) => pt.type === selectedType)?.route}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
