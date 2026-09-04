import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/help")({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-bold">Help center</h1>
      <p className="text-muted-foreground mt-2">We're here to help. Reach us anytime.</p>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {[
          ["WhatsApp", "+237 6XX XXX XXX"],
          ["Email", "jstorecare@gmail.cm"],
          ["Hours", "7 days · 8am–10pm WAT"],
          ["Office", "Akwa, Douala"],
        ].map(([k, v]) => (
          <div key={k} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-gold font-semibold">{k}</p>
            <p className="font-medium mt-1">{v}</p>
          </div>
        ))}
      </div>
      <Link to="/" className="inline-block mt-8 text-gold hover:underline">
        ← Back home
      </Link>
    </div>
  ),
  head: () => ({ meta: [{ title: "Help — J-STORE.cm" }] }),
});
