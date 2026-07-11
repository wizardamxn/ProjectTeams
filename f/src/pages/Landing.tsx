import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import {
  MessageSquare,
  FileText,
  Database,
  Users,
  KeyRound,
  ArrowRight,
  Sparkles,
  Check,
  Zap,
  Github,
  Globe,
  Circle,
} from "@/components/icons";

import { FlipWords } from "@/components/ace/flip-words";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";
import { BentoGrid, BentoGridItem } from "@/components/ace/bento-grid";
import {
  CardContainer,
  CardBody,
  CardItem,
} from "@/components/ace/card-3d";
import { InfiniteMovingCards } from "@/components/ace/infinite-moving-cards";
import { WobbleCard } from "@/components/ace/wobble-card";

/* ---------- Brand mark ---------- */
const BrandMark = ({ className = "" }: { className?: string }) => (
  <span
    className={`text-[15px] font-bold tracking-tight text-white ${className}`}
  >
    Project Teams
  </span>
);

/* ---------- Floating navbar ---------- */
const FloatingNav = ({ isAuthed }: { isAuthed: boolean }) => {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 40));

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <motion.nav
        animate={{
          width: scrolled ? "min(680px, 100%)" : "min(1120px, 100%)",
          backgroundColor: scrolled
            ? "hsl(240 10% 6% / 0.8)"
            : "hsl(240 10% 6% / 0.3)",
        }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className="flex items-center justify-between gap-4 rounded-full border border-white/10 px-4 py-2.5 backdrop-blur-xl"
      >
        <Link to="/">
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {["Features", "How it works", "Testimonials"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="rounded-full px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Link to="/dashboard">
              <HoverBorderGradient className="px-4 py-2 text-sm">
                <span className="flex items-center gap-1.5">
                  Open app <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </HoverBorderGradient>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:text-white sm:block"
              >
                Sign in
              </Link>
              <Link to="/signup">
                <HoverBorderGradient className="px-4 py-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </HoverBorderGradient>
              </Link>
            </>
          )}
        </div>
      </motion.nav>
    </motion.header>
  );
};

/* ---------- Fake app window (the "wow" mockup) ---------- */
const ProductMockup = () => {
  return (
    <CardContainer className="w-full py-0" containerClassName="w-full py-0">
      <CardBody className="relative h-auto w-full max-w-5xl">
        <CardItem
          translateZ={40}
          className="w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-2xl glow-emerald-lg"
        >
          {/* window chrome */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-zinc-900/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-500/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            <div className="ml-4 flex-1 rounded-md bg-zinc-800/60 px-3 py-1 text-center text-[11px] text-zinc-500">
              teams.app / workspace
            </div>
          </div>

          <div className="grid h-[340px] grid-cols-12 sm:h-[400px]">
            {/* mini sidebar */}
            <div className="col-span-2 hidden flex-col gap-3 border-r border-white/[0.06] bg-zinc-900/30 p-3 sm:flex">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600" />
              {[MessageSquare, FileText, Database, Users].map((Icon, i) => (
                <div
                  key={i}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    i === 1 ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ))}
            </div>

            {/* doc editor */}
            <div className="col-span-12 flex flex-col gap-3 p-5 sm:col-span-6">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-zinc-200">
                  Q3 Product Roadmap
                </span>
              </div>
              <div className="space-y-2.5">
                <div className="h-3 w-3/4 rounded bg-zinc-800" />
                <div className="h-3 w-full rounded bg-zinc-800/70" />
                <div className="h-3 w-5/6 rounded bg-zinc-800/70" />
                <div className="flex items-center gap-1">
                  <div className="h-3 w-1/2 rounded bg-zinc-800/70" />
                  {/* live collaborator cursor */}
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="relative"
                  >
                    <span className="inline-block h-3.5 w-0.5 bg-emerald-400 align-middle" />
                    <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-medium text-zinc-950">
                      Aman
                    </span>
                  </motion.div>
                </div>
                <div className="h-3 w-2/3 rounded bg-zinc-800/70" />
                <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                    <Sparkles className="h-3 w-3" /> AI summary
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="h-2 w-full rounded bg-emerald-500/10" />
                    <div className="h-2 w-4/5 rounded bg-emerald-500/10" />
                  </div>
                </div>
              </div>
            </div>

            {/* chat panel */}
            <div className="col-span-4 hidden flex-col border-l border-white/[0.06] bg-zinc-900/30 p-4 sm:flex">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Team chat
              </div>
              <div className="flex flex-1 flex-col justify-end gap-2.5">
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-700 text-center text-[10px] leading-6 text-zinc-300">
                    S
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-300">
                    Roadmap looks solid 🔥
                  </div>
                </div>
                <div className="flex items-start justify-end gap-2">
                  <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-500 to-teal-600 px-3 py-1.5 text-[11px] text-white">
                    Shipping Friday!
                  </div>
                </div>
                {/* typing indicator */}
                <div className="flex items-center gap-1.5 pl-8">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -3, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-zinc-500"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardItem>
      </CardBody>
    </CardContainer>
  );
};

/* ---------- Feature bento visuals ---------- */
const ChatVisual = () => (
  <div className="flex h-full min-h-[7rem] flex-col justify-end gap-2 rounded-lg bg-zinc-950/40 p-3">
    {["Standup in 5?", "On my way ⚡", "Deploy is green ✅"].map((t, i) => (
      <motion.div
        key={t}
        initial={{ opacity: 0, x: i % 2 ? 20 : -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.15 }}
        className={`w-fit max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${
          i % 2
            ? "ml-auto bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
            : "bg-zinc-800 text-zinc-300"
        }`}
      >
        {t}
      </motion.div>
    ))}
  </div>
);

const DocVisual = () => (
  <div className="flex h-full min-h-[7rem] flex-col gap-2 rounded-lg bg-zinc-950/40 p-3">
    <div className="h-2.5 w-1/2 rounded bg-zinc-700" />
    <div className="h-2 w-full rounded bg-zinc-800" />
    <div className="flex items-center gap-1">
      <div className="h-2 w-2/3 rounded bg-zinc-800" />
      <motion.span
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="inline-block h-3 w-0.5 bg-emerald-400"
      />
    </div>
    <div className="h-2 w-5/6 rounded bg-zinc-800" />
    <div className="mt-auto flex -space-x-2">
      {["A", "S", "K"].map((c, i) => (
        <div
          key={c}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-900 bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-[9px] font-semibold text-white"
          style={{ zIndex: 3 - i }}
        >
          {c}
        </div>
      ))}
    </div>
  </div>
);

const RagVisual = () => (
  <div className="flex h-full min-h-[7rem] flex-col justify-center gap-2 rounded-lg bg-zinc-950/40 p-3">
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400">
      <Sparkles className="h-3 w-3 text-emerald-400" /> Ask your docs anything…
    </div>
    {[100, 80, 60].map((w, i) => (
      <motion.div
        key={i}
        initial={{ width: 0 }}
        whileInView={{ width: `${w}%` }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 + i * 0.15, duration: 0.6 }}
        className="h-2 rounded bg-gradient-to-r from-emerald-500/40 to-teal-500/10"
      />
    ))}
  </div>
);

const PresenceVisual = () => (
  <div className="flex h-full min-h-[7rem] items-center justify-center gap-3 rounded-lg bg-zinc-950/40 p-3">
    {["A", "S", "K", "M"].map((c, i) => (
      <div key={c} className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-xs font-semibold text-white">
          {c}
        </div>
        <motion.span
          animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-zinc-950"
        />
      </div>
    ))}
  </div>
);

const CodeVisual = () => (
  <div className="flex h-full min-h-[7rem] items-center justify-center rounded-lg bg-zinc-950/40 p-3">
    <div className="flex gap-1.5 font-mono">
      {"48210".split("").map((d, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="flex h-9 w-8 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] text-lg font-semibold text-emerald-300"
        >
          {d}
        </motion.span>
      ))}
    </div>
  </div>
);

/* ---------- How it works ---------- */
const steps = [
  {
    n: "01",
    title: "Create your team",
    body: "Spin up a workspace in seconds. You get a unique team code to share.",
  },
  {
    n: "02",
    title: "Invite with a code",
    body: "Teammates enter your 8-digit code at signup and land right inside.",
  },
  {
    n: "03",
    title: "Collaborate live",
    body: "Chat, co-write docs, and query your AI knowledge base — all in real time.",
  },
];

/* ---------- Testimonials ---------- */
const testimonials = [
  {
    quote:
      "It replaced our Slack and Notion in a week. The live doc editing alone sold the whole team.",
    name: "Sarah Chen",
    title: "Eng Lead, Northwind",
  },
  {
    quote:
      "Asking questions against our own docs and getting real answers is genuinely magic.",
    name: "Marcus Lee",
    title: "PM, Loop Labs",
  },
  {
    quote:
      "Presence + chat + docs in one calm surface. No more twelve tabs to run a standup.",
    name: "Priya Nair",
    title: "Founder, Kite",
  },
  {
    quote: "The onboarding is a single code. Non-technical teammates were in instantly.",
    name: "Diego Alvarez",
    title: "Ops, Fathom",
  },
];

/* ================= PAGE ================= */
export default function Landing() {
  const navigate = useNavigate();
  const user = useSelector((s: any) => s?.user?.user);
  const isAuthed = !!user;

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100 antialiased">
      <FloatingNav isAuthed={isAuthed} />

      {/* ============ HERO ============ */}
      <section className="relative min-h-screen w-full bg-zinc-950">
        <div className="bg-grid mask-radial-faded pointer-events-none absolute inset-0 opacity-[0.4]" />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-36 pb-20 text-center md:pt-44">
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            The workspace where <br className="hidden sm:block" />
            your team{" "}
            <span className="relative inline-flex text-emerald-400">
              <FlipWords
                words={["thinks", "writes", "chats", "ships"]}
                className="text-emerald-400"
              />
            </span>
            <br />
            <span className="text-emerald-400">together.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg"
          >
            Real-time chat, collaborative documents, and an AI knowledge base —
            one calm workspace for your whole team. No more tab-switching chaos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <button onClick={() => navigate(isAuthed ? "/dashboard" : "/signup")}>
              <HoverBorderGradient className="px-6 py-3 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  {isAuthed ? "Open your workspace" : "Start for free"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </HoverBorderGradient>
            </button>
            <a
              href="#features"
              className="group flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              See how it works
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-6 flex items-center gap-4 text-xs text-zinc-500"
          >
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> No credit card
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Free to start
            </span>
          </motion.div>
        </div>

        {/* mockup floats over the fold */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
          className="relative z-10 mx-auto -mb-24 w-full max-w-5xl px-4 pb-10"
        >
          <ProductMockup />
        </motion.div>
      </section>

      {/* ============ LOGO / TRUST STRIP ============ */}
      <div className="border-y border-white/[0.06] bg-zinc-950 py-10">
        <div className="mx-auto max-w-5xl px-4">
          <p className="mb-6 text-center text-xs uppercase tracking-widest text-zinc-600">
            Everything your team needs, in one place
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-zinc-500">
            {[
              [MessageSquare, "Live Chat"],
              [FileText, "Docs"],
              [Database, "AI Knowledge"],
              [Users, "Presence"],
              [KeyRound, "Team Codes"],
              [Zap, "Real-time"],
            ].map(([Icon, label]: any, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-emerald-500/70" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ FEATURES BENTO ============ */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 md:py-32">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
            Features
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            One workspace.{" "}
            <span className="text-gradient">Everything</span>{" "}
            your team runs on.
          </h2>
          <p className="mt-4 text-zinc-400">
            Stop stitching together five tools. Chat, docs, and AI knowledge live
            side by side.
          </p>
        </div>

        <BentoGrid className="md:auto-rows-[20rem]">
          <BentoGridItem
            className="md:col-span-2"
            header={<ChatVisual />}
            icon={<MessageSquare className="h-5 w-5 text-emerald-400" />}
            title="Real-time team chat"
            description="Instant Socket.IO messaging with delivery you can feel. DMs, presence, and day separators built in."
          />
          <BentoGridItem
            header={<RagVisual />}
            icon={<Database className="h-5 w-5 text-emerald-400" />}
            title="AI knowledge base"
            description="Upload docs, ask questions, get grounded answers from your own content."
          />
          <BentoGridItem
            header={<PresenceVisual />}
            icon={<Users className="h-5 w-5 text-emerald-400" />}
            title="Live presence"
            description="See who's online and who's typing, the moment it happens."
          />
          <BentoGridItem
            className="md:col-span-2"
            header={<DocVisual />}
            icon={<FileText className="h-5 w-5 text-emerald-400" />}
            title="Collaborative documents"
            description="Co-write with live cursors, auto-save, version history, and one-click AI summaries."
          />
        </BentoGrid>

        {/* wide team-code card */}
        <div className="mt-4">
          <WobbleCard containerClassName="min-h-[12rem] bg-gradient-to-br from-emerald-600/20 via-zinc-900 to-zinc-900">
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-emerald-400">
                  <KeyRound className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Frictionless onboarding
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  Invite your whole team with one code.
                </h3>
                <p className="mt-2 max-w-md text-sm text-zinc-400">
                  No seat management, no email chains. Share an 8-digit code and
                  teammates are in.
                </p>
              </div>
              <div className="flex justify-center md:justify-end">
                <CodeVisual />
              </div>
            </div>
          </WobbleCard>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section
        id="how-it-works"
        className="relative border-t border-white/[0.06] bg-zinc-950 py-24 md:py-32"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
              How it works
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Up and running in{" "}
              <span className="text-gradient">minutes.</span>
            </h2>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* connecting beam */}
            <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent md:block" />
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center md:text-left"
              >
                <div className="mx-auto mb-5 flex h-18 w-18 items-center justify-center md:mx-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-zinc-900 text-2xl text-emerald-400">
                    {s.n}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {s.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section
        id="testimonials"
        className="border-t border-white/[0.06] bg-zinc-950 py-24"
      >
        <div className="mx-auto mb-12 max-w-2xl px-4 text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
            Loved by teams
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Teams don't go back.
          </h2>
        </div>
        <InfiniteMovingCards
          items={testimonials}
          direction="left"
          speed="slow"
          className="mx-auto"
        />
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative overflow-hidden border-t border-white/[0.06] bg-zinc-950 py-28">
        <div className="bg-grid mask-radial-faded pointer-events-none absolute inset-0 opacity-[0.3]" />
        <div className="relative z-10 mx-auto max-w-2xl px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold tracking-tight text-white sm:text-6xl"
          >
            Bring your team{" "}
            <span className="text-gradient">together.</span>
          </motion.h2>
          <p className="mx-auto mt-5 max-w-md text-zinc-400">
            Start free today. Your whole team, one calm workspace — chat, docs,
            and AI, all in real time.
          </p>
          <div className="mt-9 flex justify-center">
            <button onClick={() => navigate(isAuthed ? "/dashboard" : "/signup")}>
              <HoverBorderGradient className="px-7 py-3.5 text-base font-semibold">
                <span className="flex items-center gap-2">
                  {isAuthed ? "Open your workspace" : "Get started — it's free"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </HoverBorderGradient>
            </button>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/[0.06] bg-zinc-950 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 md:flex-row">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <BrandMark />
            <p className="text-sm text-zinc-500">
              The workspace where your team thinks together.
            </p>
          </div>
          <div className="flex items-center gap-5 text-sm text-zinc-400">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How it works
            </a>
            <Link to="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/wizardamxn"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="https://amanahmad.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
            >
              <Globe className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-white/[0.06] px-4 pt-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} Project Teams · Crafted by Aman Ahmad
        </div>
      </footer>
    </div>
  );
}
