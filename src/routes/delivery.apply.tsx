import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Camera, CheckCircle2, Loader2, Upload, UserRound, Truck } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/delivery/apply")({
  component: DeliveryApplyPage,
  head: () => ({ meta: [{ title: "Apply for delivery — J-STORE.cm" }] }),
});

type ApplicantType = "individual" | "company";

const emptyForm = {
  applicant_type: "individual" as ApplicantType,
  full_name: "",
  phone: "",
  city: "",
  vehicle_type: "moto",
  company_name: "",
  company_registration: "",
  fleet_size: "",
  coverage_zones: "",
  experience: "",
  availability: "",
  motivation: "",
};

function DeliveryApplyPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [companyFile, setCompanyFile] = useState<File | null>(null);

  const { data: existing = [] } = useQuery({
    queryKey: ["my-delivery-applications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_applications")
        .select("id, applicant_type, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  async function uploadDoc(file: File | null, label: string) {
    if (!file || !user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${label}.${ext}`;
    const { error } = await supabase.storage
      .from("delivery-docs")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in before applying.");
      const [id_url, license_url, company_document_url] = await Promise.all([
        uploadDoc(idFile, "id"),
        uploadDoc(licenseFile, "license"),
        uploadDoc(companyFile, "company-doc"),
      ]);

      const { error } = await supabase.from("delivery_applications").insert({
        user_id: user.id,
        applicant_type: form.applicant_type,
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
        vehicle_type: form.applicant_type === "individual" ? form.vehicle_type : null,
        company_name: form.applicant_type === "company" ? form.company_name : null,
        company_registration: form.applicant_type === "company" ? form.company_registration : null,
        fleet_size:
          form.applicant_type === "company" && form.fleet_size ? Number(form.fleet_size) : null,
        coverage_zones: form.coverage_zones
          .split(",")
          .map((z) => z.trim())
          .filter(Boolean),
        experience: form.experience,
        availability: form.availability,
        motivation: form.motivation,
        id_url,
        license_url,
        company_document_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery application submitted");
      navigate({ to: "/profile" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <Truck className="mx-auto mb-4 h-12 w-12 text-gold" />
        <h1 className="font-display text-3xl font-bold">Sign in to apply</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create or access your J-STORE account before applying for delivery access.
        </p>
        <Button
          asChild
          className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/login" search={{ redirect: "/delivery/apply" }}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Delivery network
          </p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Apply for delivery access</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Register as an independent delivery partner or as a delivery company. Super admins
            review applications before dashboard access is granted.
          </p>
        </div>
      </div>

      {existing.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">
            Latest application: <span className="capitalize text-gold">{existing[0].status}</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            You can submit a new application if your delivery details have changed.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="rounded-3xl border border-border bg-card p-6 shadow-elegant md:p-8"
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {(["individual", "company"] as ApplicantType[]).map((type) => {
            const active = form.applicant_type === type;
            const Icon = type === "individual" ? UserRound : Building2;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, applicant_type: type })}
                className={`rounded-2xl border p-4 text-left transition-colors ${active ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"}`}
              >
                <Icon className="mb-3 h-5 w-5 text-gold" />
                <p className="font-semibold capitalize">{type}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {type === "individual"
                    ? "One person handling deliveries."
                    : "A registered company with a delivery team."}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Full name / contact person">
            <Input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+237 ..."
            />
          </Field>
          <Field label="Base city">
            <Input
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Douala"
            />
          </Field>
          {form.applicant_type === "individual" ? (
            <Field label="Vehicle type">
              <Select
                value={form.vehicle_type}
                onValueChange={(value) => setForm({ ...form, vehicle_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bicycle">Bicycle</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Fleet size">
              <Input
                required
                type="number"
                min="1"
                value={form.fleet_size}
                onChange={(e) => setForm({ ...form, fleet_size: e.target.value })}
              />
            </Field>
          )}
          {form.applicant_type === "company" && (
            <>
              <Field label="Company name">
                <Input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </Field>
              <Field label="Registration number">
                <Input
                  value={form.company_registration}
                  onChange={(e) => setForm({ ...form, company_registration: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Coverage zones">
            <Input
              value={form.coverage_zones}
              onChange={(e) => setForm({ ...form, coverage_zones: e.target.value })}
              placeholder="Akwa, Bonamoussadi, Bastos"
            />
          </Field>
          <Field label="Availability">
            <Input
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              placeholder="Weekdays, weekends, full-time"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Experience">
              <Textarea
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
                placeholder="Tell us about your delivery experience."
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Why should J-STORE approve you?">
              <Textarea
                value={form.motivation}
                onChange={(e) => setForm({ ...form, motivation: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <FileInput label="ID document" capture="environment" file={idFile} onChange={setIdFile} />
          <FileInput
            label="Licence / vehicle proof"
            capture="environment"
            file={licenseFile}
            onChange={setLicenseFile}
          />
          {form.applicant_type === "company" && (
            <FileInput label="Company document" file={companyFile} onChange={setCompanyFile} />
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            type="submit"
            disabled={submit.isPending}
            className="rounded-full bg-navy px-8 text-navy-foreground hover:bg-gold hover:text-gold-foreground"
          >
            {submit.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Submit application
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

// ... existing code ...

function FileInput({
  label,
  file,
  capture,
  onChange,
}: {
  label: string;
  file: File | null;
  capture?: "environment";
  onChange: (file: File | null) => void;
}) {
  const inputId = `file-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block cursor-pointer rounded-2xl border border-dashed border-border p-4 text-sm transition-colors hover:border-gold/50"
      >
        <span className="mb-2 flex items-center gap-2 font-semibold">
          <Upload className="h-4 w-4 text-gold" /> {label}
        </span>
        <span className="mb-3 block text-xs text-muted-foreground">
          Upload from files or use camera.
        </span>

        <span className="inline-flex rounded-full bg-navy px-4 py-2 text-xs font-semibold text-navy-foreground">
          Choose file
        </span>

        {file && (
          <span className="mt-2 flex items-center gap-1 text-xs text-gold">
            <Camera className="h-3 w-3" /> {file.name}
          </span>
        )}
      </label>

      <Input
        id={inputId}
        type="file"
        accept="image/*,.pdf"
        capture={capture}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
