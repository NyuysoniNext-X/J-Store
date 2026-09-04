import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Wallet, Users, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { partnersService } from "@/lib/services";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_partner/partner/dashboard")({
  component: PartnerDashboard,
  head: () => ({ meta: [{ title: "Partner dashboard — J-STORE.cm" }] }),
});

function PartnerDashboard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["partner-profile", user?.id],
    queryFn: () => partnersService.getOwnProfile(user!.id),
    enabled: !!user,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["partner-commissions", user?.id],
    queryFn: () => partnersService.listCommissions(user!.id),
    enabled: !!user,
  });

  const { data: referredUsers = [] } = useQuery({
    queryKey: ["partner-referrals", user?.id],
    queryFn: () => partnersService.listReferredUsers(user!.id),
    enabled: !!user,
  });

  const totals = useMemo(() => {
    const paid = commissions
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + c.commission_amount, 0);
    const pending = commissions
      .filter((c) => c.status !== "paid")
      .reduce((s, c) => s + c.commission_amount, 0);
    return { paid, pending, all: paid + pending };
  }, [commissions]);

  const referralLink = profile?.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${profile.referral_code}`
    : null;

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied");
    } catch {
      toast.error("Unable to copy referral link");
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: "Total earned", value: formatXAF(totals.all), icon: Wallet },
    { label: "Paid out", value: formatXAF(totals.paid), icon: Wallet },
    { label: "Pending", value: formatXAF(totals.pending), icon: Wallet },
    { label: "Referred users", value: referredUsers.length.toString(), icon: Users },
  ];

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">
          Partner dashboard
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
      </div>

      {/* Referral link */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gold" /> Your referral link
        </h2>
        {referralLink ? (
          <div className="flex items-center gap-2 flex-wrap">
            <code className="flex-1 min-w-0 truncate bg-secondary rounded-lg px-4 py-2.5 text-sm">
              {referralLink}
            </code>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy text-navy-foreground px-4 py-2.5 text-sm font-medium hover:bg-gold hover:text-gold-foreground transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No referral code assigned yet — ask a J-STORE admin to set one up for your account.
          </p>
        )}
        {profile && (
          <p className="text-xs text-muted-foreground mt-3">
            Commission rate: {(profile.commission_rate * 100).toFixed(1)}% per completed order from
            someone you referred.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl p-5 shadow-elegant"
          >
            <s.icon className="h-5 w-5 text-gold mb-3" />
            <p className="font-display text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Commission ledger */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display font-semibold mb-4">Commission history</h2>
        {commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No commissions yet — they appear once a referred buyer's order is completed.
          </p>
        ) : (
          <ul className="text-sm divide-y divide-border">
            {commissions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{formatXAF(c.commission_amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    "text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full " +
                    (c.status === "paid"
                      ? "bg-emerald/15 text-emerald"
                      : c.status === "confirmed"
                        ? "bg-gold/15 text-gold"
                        : "bg-secondary text-muted-foreground")
                  }
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
