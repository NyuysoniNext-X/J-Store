import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Upload,
  Users,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/seller/register")({
  component: SellerRegister,
  head: () => ({ meta: [{ title: "Sell on J-STORE.cm" }] }),
});

function SellerRegister() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    store_name: "",
    business_type: "",
    owner_name: "",
    phone: "",
    email: user?.email ?? "",
    city: "",
    tax_id: "",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [businessFile, setBusinessFile] = useState<File | null>(null);

  async function uploadDocument(file: File, label: string) {
    if (!user) throw new Error(t("sellerApply.signInFirst"));
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user.id}/${Date.now()}-${label}.${extension}`;
    const { error } = await supabase.storage
      .from("seller-docs")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t("sellerApply.signInFirst"));
      if (
        !form.store_name.trim() ||
        !form.owner_name.trim() ||
        !form.phone.trim() ||
        !form.city.trim()
      ) {
        throw new Error(t("sellerApply.completeRequired"));
      }
      if (!idFile) throw new Error(t("sellerApply.uploadId"));

      const idDocumentPath = await uploadDocument(idFile, "id");
      let businessRegistrationPath: string | null = null;
      try {
        if (businessFile) businessRegistrationPath = await uploadDocument(businessFile, "business");

        const { error } = await supabase.from("seller_applications").insert({
          user_id: user.id,
          store_name: form.store_name.trim(),
          business_type: form.business_type.trim() || null,
          owner_name: form.owner_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          city: form.city.trim(),
          tax_id: form.tax_id.trim() || null,
          id_document_url: idDocumentPath,
          business_registration_url: businessRegistrationPath,
        });
        if (error) throw error;
      } catch (error) {
        await supabase.storage.from("seller-docs").remove([idDocumentPath]);
        if (businessRegistrationPath) {
          await supabase.storage.from("seller-docs").remove([businessRegistrationPath]);
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("sellerApply.submitted"));
      navigate({ to: "/profile" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-gold" />
        <h1 className="font-display text-3xl font-bold">{t("sellerApply.signInToApply")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("sellerApply.accountPrompt")}</p>
        <Button
          asChild
          className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/login" search={{ redirect: "/seller/register" }}>
            {t("sellerApply.signIn")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <section className="bg-gradient-navy text-navy-foreground">
        <div className="mx-auto max-w-[1536px] px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-gold text-xs uppercase tracking-[0.2em] font-semibold">
              {t("sellerApply.becomeSeller")}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold mt-3 leading-tight">
              {t("sellerApply.growBusiness")} <span className="text-gradient-gold">Cameroon</span>
            </h1>
            <p className="text-navy-foreground/80 mt-4 text-lg max-w-lg">
              {t("sellerApply.reachShoppers")}
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button
                asChild
                className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90 h-12 px-7"
              >
                <a href="#apply">
                  {t("sellerApply.startSelling")} <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full h-12 px-7 bg-transparent border-white/20 text-navy-foreground hover:bg-white/10"
              >
                <Link to="/">{t("sellerApply.learnMore")}</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, k: "120K+", v: t("sellerApply.activeBuyers") },
              { icon: TrendingUp, k: "0%", v: t("sellerApply.listingFees") },
              { icon: Wallet, k: "T+1", v: t("sellerApply.fastPayouts") },
              { icon: ShieldCheck, k: "24/7", v: t("sellerApply.sellerSupport") },
            ].map((s, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10"
              >
                <s.icon className="h-6 w-6 text-gold" />
                <p className="font-display text-3xl font-bold mt-3">{s.k}</p>
                <p className="text-sm text-navy-foreground/70">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="apply" className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-center mb-8">
          <Logo />
        </div>
        <div className="bg-card border border-border rounded-3xl p-8 md:p-10 shadow-elegant">
          <h2 className="font-display text-2xl font-bold">{t("sellerApply.application")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("sellerApply.reviewTime")}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit.mutate();
            }}
            className="space-y-4 mt-6"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label={t("sellerApply.businessName")}
                required
                value={form.store_name}
                onChange={(value) => setForm({ ...form, store_name: value })}
              />
              <Field
                label={t("sellerApply.businessType")}
                required
                value={form.business_type}
                onChange={(value) => setForm({ ...form, business_type: value })}
              />
              <Field
                label={t("sellerApply.ownerName")}
                required
                value={form.owner_name}
                onChange={(value) => setForm({ ...form, owner_name: value })}
              />
              <Field
                label={t("sellerApply.phone")}
                required
                value={form.phone}
                onChange={(value) => setForm({ ...form, phone: value })}
              />
              <Field
                label={t("sellerApply.email")}
                type="email"
                required
                className="sm:col-span-2"
                value={form.email}
                onChange={(value) => setForm({ ...form, email: value })}
              />
              <Field
                label={t("sellerApply.city")}
                required
                value={form.city}
                onChange={(value) => setForm({ ...form, city: value })}
              />
              <Field
                label={t("sellerApply.taxId")}
                value={form.tax_id}
                onChange={(value) => setForm({ ...form, tax_id: value })}
              />
            </div>
            <FileField
              label={t("sellerApply.uploadIdLabel")}
              required
              file={idFile}
              onChange={setIdFile}
            />
            <FileField
              label={t("sellerApply.businessRegistration")}
              file={businessFile}
              onChange={setBusinessFile}
            />
            <Button
              type="submit"
              disabled={submit.isPending}
              className="rounded-full h-12 px-8 bg-gold text-gold-foreground hover:bg-gold/90"
            >
              {submit.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {submit.isPending ? t("sellerApply.submitting") : t("sellerApply.submit")}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  className,
  required,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  className?: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={className}>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
      />
    </div>
  );
}

function FileField({
  label,
  required,
  file,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const { t } = useI18n();
  const inputId = `seller-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-gold transition-colors"
      >
        <Upload className="mx-auto mb-2 h-5 w-5 text-gold" />
        <span className="font-medium">
          {label}
          {required ? " *" : ""}
        </span>
        <span className="mt-1 block text-xs">{t("sellerApply.fileRequirements")}</span>
        {file && <span className="mt-2 block text-xs text-gold">{file.name}</span>}
      </label>
      <input
        id={inputId}
        type="file"
        required={required && !file}
        accept="image/*,.pdf"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          if (selected && selected.size > 10 * 1024 * 1024) {
            toast.error(t("sellerApply.fileTooLarge"));
            event.currentTarget.value = "";
            return;
          }
          onChange(selected);
        }}
      />
    </div>
  );
}
