import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "@/components/icons";

// Display only: there is no billing yet, and nothing below is enforced.
// Prices are placeholders until paid plans launch.
interface Plan {
  name: string;
  price: string;
  per?: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  soon?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    blurb: "For small teams getting started.",
    features: [
      "Up to 10 members",
      "Channels, DMs, threads and docs",
      "Ask AI: 50 questions a month",
      "1 GB of files",
      "Export your data any time",
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$8",
    per: "per member / month",
    blurb: "For teams that live in their workspace.",
    features: [
      "Unlimited members",
      "Ask AI: 1,000 questions a month",
      "10 GB of files per member",
      "Full version history",
      "Audit log",
    ],
    cta: "Start free",
    highlight: true,
    soon: true,
  },
  {
    name: "Business",
    price: "$15",
    per: "per member / month",
    blurb: "For companies with security and admin needs.",
    features: ["Everything in Pro", "Unlimited AI questions", "SAML single sign-on", "1-year audit log retention", "Priority support"],
    cta: "Start free",
    soon: true,
  },
];

export function Pricing({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section id="pricing" className="border-t border-white/[0.06] bg-zinc-950 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Pricing</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Simple plans that <span className="text-gradient">grow with you.</span>
          </h2>
          <p className="mt-4 text-zinc-400">Every feature is free during early access. Paid plans are coming soon.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight ? "border-emerald-500/40 bg-emerald-500/[0.04] shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]" : "border-white/[0.08] bg-zinc-900/40"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">Most popular</span>
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                {plan.soon && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">Coming soon</span>}
              </div>
              <p className="mt-1 text-sm text-zinc-400">{plan.blurb}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-white">{plan.price}</span>
                {plan.per && <span className="text-sm text-zinc-500">{plan.per}</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={isAuthed ? "/dashboard" : "/signup"}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlight ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-white/10 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {isAuthed ? "Open your workspace" : plan.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
