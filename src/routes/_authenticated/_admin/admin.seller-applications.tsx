import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquarePlus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/_admin/admin/seller-applications")({
  component: AdminSellerApplications,
  head: () => ({ meta: [{ title: "Seller applications — J-STORE.cm" }] }),
});

type Application = {
  id: string;
  user_id: string;
  store_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  city: string;
  business_type: string | null;
  tax_id: string | null;
  id_document_url: string | null;
  business_registration_url: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  requested_info_at: string | null;
  created_at: string;
};

type Note = {
  id: string;
  application_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  approved: "bg-gold-500/15 text-gold-700 border-gold-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  info_requested: "bg-blue-500/15 text-blue-600 border-blue-500/30",
};

function statusLabel(s: string) {
  return s === "info_requested" ? "Info requested" : s.charAt(0).toUpperCase() + s.slice(1);
}

function docUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("seller-docs").getPublicUrl(path);
  return data.publicUrl;
}

function AdminSellerApplications() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [noteBody, setNoteBody] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // ── Applications ──────────────────────────────────────────────────────────
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin-seller-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Application[];
    },
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  const { data: notes = [] } = useQuery({
    queryKey: ["admin-seller-app-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_application_notes")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Note[];
    },
  });

  // ── Approve ───────────────────────────────────────────────────────────────
  const approve = useMutation({
    mutationFn: async (app: Application) => {
      const { error: appErr } = await supabase
        .from("seller_applications")
        .update({
          status: "approved",
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);
      if (appErr) throw appErr;

      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: app.user_id, role: "seller" });
      if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) throw roleErr;

      // Notify applicant
      await supabase.from("notifications").insert({
        user_id: app.user_id,
        title: "Seller application approved",
        body: `Congratulations! Your store "${app.store_name}" has been approved. You can now list products.`,
      });
    },
    onSuccess: () => {
      toast.success(t("roles.application_approved_toast"));
      qc.invalidateQueries({ queryKey: ["admin-seller-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Reject ────────────────────────────────────────────────────────────────
  const reject = useMutation({
    mutationFn: async ({ app, reason }: { app: Application; reason: string }) => {
      const { error } = await supabase
        .from("seller_applications")
        .update({
          status: "rejected",
          rejection_reason: reason.trim() || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: app.user_id,
        title: "Seller application update",
        body: reason.trim()
          ? `Your application for "${app.store_name}" was not approved: ${reason.trim()}`
          : `Your application for "${app.store_name}" was not approved at this time.`,
      });
    },
    onSuccess: () => {
      toast.success(t("roles.application_rejected"));
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-seller-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Request more info ─────────────────────────────────────────────────────
  const requestInfo = useMutation({
    mutationFn: async ({ app, message }: { app: Application; message: string }) => {
      const { error } = await supabase
        .from("seller_applications")
        .update({
          status: "info_requested",
          requested_info_at: new Date().toISOString(),
        })
        .eq("id", app.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: app.user_id,
        title: "More info needed for your application",
        body:
          message.trim() ||
          `We need additional information for your store "${app.store_name}". Please update your application.`,
      });
    },
    onSuccess: () => {
      toast.success(t("roles.info_request_sent_to_applicant"));
      qc.invalidateQueries({ queryKey: ["admin-seller-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Add note ──────────────────────────────────────────────────────────────
  const addNote = useMutation({
    mutationFn: async ({ appId, body }: { appId: string; body: string }) => {
      const { error } = await supabase.from("seller_application_notes").insert({
        application_id: appId,
        author_id: user!.id,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(t("roles.note_saved"));
      setNoteBody((prev) => ({ ...prev, [v.appId]: "" }));
      qc.invalidateQueries({ queryKey: ["admin-seller-app-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = applications.filter((a) => filter === "all" || a.status === filter);
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
              {t("roles.admin")}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {t("roles.seller_applications")}
            </h1>
          </div>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
            {t("roles.pending_count", { count: pendingCount })}
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-navy text-navy-foreground border-navy"
                : "border-border hover:border-gold/40"
            }`}
          >
            {f === "all" ? t("roles.all") : statusLabel(f)}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground">{t("roles.no_applications_in_this_category")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => {
            const isOpen = expanded === app.id;
            const appNotes = notes.filter((n) => n.application_id === app.id);
            const idUrl = docUrl(app.id_document_url);
            const bizUrl = docUrl(app.business_registration_url);

            return (
              <div
                key={app.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Summary row */}
                <button
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                >
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{app.store_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {app.owner_name} · {app.city} ·{" "}
                        {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${STATUS_COLORS[app.status] ?? ""}`}
                    >
                      {statusLabel(app.status)}
                    </Badge>
                    {appNotes.length > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t("roles.notes_count", { count: appNotes.length })}
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-border p-5 space-y-6">
                    {/* Application fields */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <Detail label={t("roles.business_name")} value={app.store_name} />
                      <Detail label={t("roles.business_type")} value={app.business_type} />
                      <Detail label={t("roles.owner")} value={app.owner_name} />
                      <Detail label={t("roles.phone")} value={app.phone} />
                      <Detail label={t("roles.email")} value={app.email} />
                      <Detail label={t("roles.city")} value={app.city} />
                      <Detail label={t("roles.tax_id")} value={app.tax_id} />
                      <Detail label={t("roles.user_id")} value={app.user_id} mono />
                      {app.rejection_reason && (
                        <Detail
                          label={t("roles.rejection_reason")}
                          value={app.rejection_reason}
                          className="sm:col-span-2 lg:col-span-3 text-destructive"
                        />
                      )}
                    </div>

                    {/* Documents */}
                    <div className="flex flex-wrap gap-3">
                      {idUrl && (
                        <a
                          href={idUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-border text-sm hover:border-gold/60 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> {t("roles.id_document")}
                        </a>
                      )}
                      {bizUrl && (
                        <a
                          href={bizUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-border text-sm hover:border-gold/60 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />{" "}
                          {t("roles.business_registration")}
                        </a>
                      )}
                    </div>

                    {/* Internal notes */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("roles.internal_notes")}
                      </p>
                      {appNotes.length > 0 ? (
                        <ul className="space-y-2">
                          {appNotes.map((n) => (
                            <li key={n.id} className="bg-muted/40 rounded-xl px-4 py-3 text-sm">
                              <p>{n.body}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("roles.no_notes_yet")}</p>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={t("roles.add_a_private_note")}
                          rows={2}
                          className="text-sm resize-none"
                          value={noteBody[app.id] ?? ""}
                          onChange={(e) => setNoteBody((p) => ({ ...p, [app.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full shrink-0 self-end"
                          disabled={!noteBody[app.id]?.trim() || addNote.isPending}
                          onClick={() => addNote.mutate({ appId: app.id, body: noteBody[app.id] })}
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Actions */}
                    {app.status === "pending" || app.status === "info_requested" ? (
                      <div className="space-y-3 pt-2 border-t border-border">
                        {/* Request info */}
                        <div className="flex gap-2">
                          <Textarea
                            placeholder={t("roles.request_more_info_prompt")}
                            rows={2}
                            className="text-sm resize-none"
                            value={noteBody[`req-${app.id}`] ?? ""}
                            onChange={(e) =>
                              setNoteBody((p) => ({ ...p, [`req-${app.id}`]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full shrink-0 self-end"
                            disabled={requestInfo.isPending}
                            onClick={() =>
                              requestInfo.mutate({
                                app,
                                message: noteBody[`req-${app.id}`] ?? "",
                              })
                            }
                          >
                            <Send className="h-4 w-4 mr-1" /> {t("roles.request_info")}
                          </Button>
                        </div>

                        {/* Reject with reason */}
                        <div className="flex gap-2">
                          <input
                            className="flex-1 h-10 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-destructive text-sm"
                            placeholder={t("roles.rejection_reason_optional_prompt")}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full shrink-0 text-destructive hover:bg-destructive/10"
                            disabled={reject.isPending}
                            onClick={() => reject.mutate({ app, reason: rejectReason })}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> {t("roles.reject")}
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-full shrink-0 bg-gold text-gold-foreground hover:bg-gold/90"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(app)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> {t("roles.approve")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground pt-2 border-t border-border">
                        {t("roles.reviewed")}{" "}
                        {app.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}
