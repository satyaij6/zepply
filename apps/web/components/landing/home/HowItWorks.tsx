"use client";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Check, Globe, Sparkles } from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import BrandIcon, { BRAND_LABELS, type Brand } from "./BrandIcon";
import SectionHeader, { Accent } from "./SectionHeader";
import { EASE_OUT, useSeen, useStepper } from "./anim";

/*
 * A pinned scene: on desktop the step index and the app window stay put while
 * the visitor scrolls through a tall track; how far they've scrolled picks the
 * active step and fills that step's progress line. On smaller screens each step
 * simply shows its own window underneath.
 */

const PLATFORMS: Brand[] = ["instagram", "youtube", "tiktok", "facebook", "whatsapp", "x"];

const STEPS: { tab: string; title: string; body: string; Screen: ComponentType }[] = [
  { tab: "Connect", title: "Connect & set up", body: "Link your accounts and let Zepply learn your brand from a website or Instagram link.", Screen: ConnectScreen },
  { tab: "Create", title: "Create & schedule", body: "Get AI posts, reels, carousels and a 2-week content calendar tailored to your brand.", Screen: CreateScreen },
  { tab: "Reply", title: "Reply & grow", body: "Automate DMs, manage comments and track results — all on autopilot.", Screen: ReplyScreen },
];

/** Scroll distance per step, in viewport heights. */
const STEP_VH = 70;

export default function HowItWorks() {
  const scene = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: scene, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))));

  const goTo = (i: number) => {
    const el = scene.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (span * (i + 0.2)) / STEPS.length, behavior: "smooth" });
  };

  return (
    <section id="how-it-works" className="scroll-mt-28 px-4 pt-28 sm:px-8 lg:px-14 lg:pt-36">
      <div className="mx-auto max-w-[1424px]">
        <SectionHeader
          align="stack"
          index="01"
          label="How it works"
          title={
            <>
              From idea to <Accent>impact</Accent>, in three simple steps.
            </>
          }
          intro="Zepply handles the boring work, so you can focus on what you do best."
        />

        <div ref={scene} className="relative hidden lg:block" style={{ height: `${STEPS.length * STEP_VH + 30}vh` }}>
          <div className="sticky top-0 flex h-screen items-center pt-16">
            <div className="grid w-full grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] items-center gap-20">
              <ol>
                {STEPS.map((step, i) => (
                  <IndexItem key={step.title} index={i} step={step} active={active === i} progress={scrollYProgress} onSelect={goTo} />
                ))}
              </ol>
              <AppFrame active={active} onSelect={goTo} />
            </div>
          </div>
        </div>

        <ol className="mt-16 space-y-20 lg:hidden">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <div className="border-l-2 border-electric pl-6">
                <span className="font-serif text-4xl italic leading-none text-silver">0{i + 1}</span>
                <h3 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-white">{step.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-zinc-400">{step.body}</p>
                {i === 0 && <PlatformRow className="mt-5" />}
              </div>
              <div className="mt-8">
                <AppFrame active={i} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function IndexItem({
  index,
  step,
  active,
  progress,
  onSelect,
}: {
  index: number;
  step: (typeof STEPS)[number];
  active: boolean;
  progress: MotionValue<number>;
  onSelect: (i: number) => void;
}) {
  // This step's slice of the scene, as a 0–100% fill
  const fill = useTransform(progress, [index / STEPS.length, (index + 1) / STEPS.length], ["0%", "100%"]);

  return (
    <li>
      <button type="button" onClick={() => onSelect(index)} aria-current={active ? "step" : undefined} className="group block w-full py-6 text-left">
        <span className="flex items-baseline gap-5">
          <span className={`w-9 shrink-0 font-serif text-3xl italic leading-none transition-colors duration-500 ${active ? "text-silver" : "text-zinc-600"}`}>0{index + 1}</span>
          <span
            className={`font-display text-[clamp(26px,2.3vw,34px)] font-semibold leading-tight tracking-[-0.025em] transition-colors duration-500 ${
              active ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
            }`}
          >
            {step.title}
          </span>
        </span>
        <motion.span
          className="block overflow-hidden"
          initial={false}
          animate={active ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <span className="ml-14 block max-w-[400px] pt-3 text-base leading-relaxed text-zinc-400 xl:text-lg">{step.body}</span>
          {index === 0 && <PlatformRow className="ml-14 pt-5" />}
        </motion.span>
        <span className="relative mt-6 block h-px overflow-hidden bg-white/10">
          <motion.span className="absolute inset-y-0 left-0 bg-electric" style={{ width: fill }} />
        </span>
      </button>
    </li>
  );
}

function PlatformRow({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-wrap gap-3 ${className}`}>
      {PLATFORMS.map((p) => (
        <span key={p}>
          <BrandIcon brand={p} size={22} mono={p === "x"} className={p === "x" ? "text-white" : undefined} />
          <span className="sr-only">{BRAND_LABELS[p]}</span>
        </span>
      ))}
    </span>
  );
}

/** Glassy bezel around a silver app window; the tabs double as step links when `onSelect` is given. */
function AppFrame({ active, onSelect }: { active: number; onSelect?: (i: number) => void }) {
  const { Screen } = STEPS[active];

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-x-8 -inset-y-12 rounded-full bg-electric/15 blur-[90px]" />
      <div className="relative rounded-[30px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="overflow-hidden rounded-[23px] bg-paper">
          <div className="flex items-center border-b border-paper-line px-5 py-3">
            <div className="flex w-10 gap-1.5 sm:w-16">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#CFD3DF]" />
              ))}
            </div>
            <div className="mx-auto flex gap-1 rounded-full bg-[#DFE2EC] p-1">
              {STEPS.map((s, i) => {
                const label = (
                  <>
                    {i === active && (
                      <motion.span layoutId={onSelect ? "frame-tab" : undefined} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ duration: 0.4, ease: EASE_OUT }} />
                    )}
                    <span className={`relative ${i === active ? "text-ink" : "text-ink-soft"}`}>{s.tab}</span>
                  </>
                );
                const cls = "relative rounded-full px-3.5 py-1 text-xs font-medium";
                return onSelect ? (
                  <button key={s.tab} type="button" onClick={() => onSelect(i)} className={cls}>
                    {label}
                  </button>
                ) : (
                  <span key={s.tab} className={cls}>
                    {label}
                  </span>
                );
              })}
            </div>
            <span className="w-10 sm:w-16" />
          </div>

          <div className="relative p-5 sm:p-6 lg:aspect-[16/10.5]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                className="h-full lg:absolute lg:inset-0 lg:p-6"
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-paper-line bg-paper-raised p-4 ${className}`}>{children}</div>;
}

function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-ink">{children}</p>
      {aside}
    </div>
  );
}

/** Pops in when `show` turns true. */
function Appear({ show, children, className, y = 8 }: { show: boolean; children: ReactNode; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={false} animate={show ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y, scale: 0.97 }} transition={{ duration: 0.45, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">{children}</p>;
}

/* ── Step 1: accounts switch on one by one while the brand profile fills in ── */

const BRAND_COLOURS = ["#3B2A20", "#C8925A", "#EADBC8", "#2F6BF0", "#F5F1EA"];
const BRAND_TONE = ["Warm", "Playful", "Coffee-first"];
const AUDIENCE = ["Coffee lovers", "22–34", "Hyderabad"];

function ConnectScreen() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const step = useStepper(seen, 10, { interval: 260 });

  return (
    <div ref={ref} className="grid h-full gap-4 sm:grid-cols-[1.05fr_1fr]">
      <Card>
        <CardTitle aside={<span className="text-xs text-ink-soft">{Math.min(step, PLATFORMS.length)}/6 connected</span>}>Connect your accounts</CardTitle>
        <ul className="mt-3 space-y-2">
          {PLATFORMS.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-xl border border-paper-line bg-white px-3 py-2.5 text-sm font-medium text-ink">
              <BrandIcon brand={p} size={20} mono={p === "x"} className={p === "x" ? "text-ink" : undefined} />
              {BRAND_LABELS[p]}
              <Toggle on={step > i} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col">
        <CardTitle>Your brand</CardTitle>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-paper-line bg-white px-3 py-2.5 text-sm text-ink">
          <Globe className="h-4 w-4 text-ink-soft" /> brewhouse.in
          <span className="ml-auto text-xs font-medium text-electric-deep">{step < 9 ? "Learning…" : "Done"}</span>
        </div>
        <Appear show={step >= 6} className="mt-5">
          <Label>Colours</Label>
          <div className="mt-2 flex gap-2">
            {BRAND_COLOURS.map((c) => (
              <span key={c} className="h-8 w-8 rounded-lg ring-1 ring-black/10" style={{ background: c }} />
            ))}
          </div>
        </Appear>
        <Appear show={step >= 7} className="mt-4">
          <Label>Voice</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BRAND_TONE.map((t) => (
              <span key={t} className="rounded-full bg-electric-wash px-2.5 py-1 text-xs font-medium text-electric-deep">
                {t}
              </span>
            ))}
          </div>
        </Appear>
        <Appear show={step >= 8} className="mt-4">
          <Label>Audience</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AUDIENCE.map((t) => (
              <span key={t} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-paper-line">
                {t}
              </span>
            ))}
          </div>
        </Appear>
        <Appear show={step >= 9} className="mt-auto pt-4">
          <p className="rounded-xl bg-white p-3 font-serif text-lg italic leading-snug text-ink">&ldquo;Slow mornings, strong coffee.&rdquo;</p>
        </Appear>
      </Card>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <motion.span className="ml-auto flex h-5 w-9 shrink-0 items-center rounded-full p-0.5" initial={false} animate={{ backgroundColor: on ? "#2F6BF0" : "#D9DCE6" }}>
      <motion.span className="h-4 w-4 rounded-full bg-white shadow" initial={false} animate={{ x: on ? 16 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
    </motion.span>
  );
}

/* ── Step 2: two weeks of posts drop into the calendar ── */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLAN: { kind: string; src?: string }[] = [
  { kind: "Reel", src: "/landing/latte-pour.jpg" },
  { kind: "Post" },
  { kind: "Carousel", src: "/landing/space.jpg" },
  { kind: "Story" },
  { kind: "Reel", src: "/landing/brew.jpg" },
  { kind: "Post", src: "/landing/latte.jpg" },
  { kind: "Story" },
  { kind: "Carousel" },
  { kind: "Reel", src: "/landing/cafe-day.jpg" },
  { kind: "Post" },
  { kind: "Story" },
  { kind: "Reel", src: "/landing/phone-cafe.jpg" },
  { kind: "Post" },
  { kind: "Carousel" },
];

function CreateScreen() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const step = useStepper(seen, PLAN.length, { interval: 140 });

  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-electric-wash text-electric-deep">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            {step < PLAN.length ? "Planning your next 2 weeks…" : "Your next 2 weeks are ready"}
          </p>
          <p className="mt-1 text-xs text-ink-soft">Based on your brand, goals and best posting times</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold tabular-nums text-ink ring-1 ring-paper-line">{step} posts</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper-line">
        <motion.div className="h-full rounded-full bg-linear-to-r from-electric-deep to-[#7FA8FF]" initial={false} animate={{ width: `${(step / PLAN.length) * 100}%` }} />
      </div>

      <div className="mt-4 grid flex-1 grid-cols-7 gap-1.5 sm:gap-2 lg:grid-rows-[auto_1fr_1fr]">
        {DAYS.map((d) => (
          <p key={d} className="text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft sm:text-[11px]">
            {d}
          </p>
        ))}
        {PLAN.map(({ kind, src }, i) => (
          <div key={i} className="relative aspect-[4/5] overflow-hidden rounded-lg border border-dashed border-paper-line bg-paper-raised lg:aspect-auto">
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={step > i ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            >
              {src ? (
                <Image src={src} alt="" fill sizes="110px" className="object-cover" />
              ) : (
                <div className="h-full bg-linear-to-br from-electric-wash to-[#EDE7FF] p-2">
                  <span className="block h-1.5 w-3/4 rounded-full bg-white/80" />
                  <span className="mt-1 block h-1.5 w-1/2 rounded-full bg-white/80" />
                </div>
              )}
              <span className="absolute bottom-1 left-1 rounded-full bg-ink/75 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur sm:text-[10px]">{kind}</span>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 3: comments get answered in DMs ── */

const COMMENTS = [
  { user: "priya.s", text: "Price for the cold brew?" },
  { user: "rahul_eats", text: "Do you deliver to Kondapur?" },
  { user: "meera.k", text: "Open on Sunday?" },
];

function ReplyScreen() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const step = useStepper(seen, 6, { interval: 650 });

  return (
    <div ref={ref} className="grid h-full gap-4 sm:grid-cols-[1fr_1.1fr]">
      <Card>
        <div className="flex items-center gap-3">
          <Image src="/landing/latte.jpg" alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">brewhouse.hyd</p>
            <p className="truncate text-xs text-ink-soft">New cold brew is here ☕</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2.5">
          {COMMENTS.map(({ user, text }, i) => (
            <li key={user} className="rounded-xl border border-paper-line bg-white p-3">
              <p className="text-xs text-ink-soft">@{user}</p>
              <p className="mt-0.5 text-sm text-ink">{text}</p>
              <Appear show={step > i * 2 + 1} y={4} className="mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#CFEFE0] px-2 py-0.5 text-[11px] font-medium text-[#0E8A5F]">
                  <Check className="h-3 w-3" strokeWidth={3} /> Replied in DM
                </span>
              </Appear>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-paper-line pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-electric-wash text-xs font-semibold text-electric-deep">PS</span>
          <div>
            <p className="text-sm font-semibold text-ink">Priya Sharma</p>
            <p className="text-xs text-ink-soft">via comment on your post</p>
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          <Appear show={step >= 1} className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm">
            Price for the cold brew?
          </Appear>
          <AnimatePresence mode="popLayout">
            {step === 2 ? (
              <motion.div key="typing" exit={{ opacity: 0, scale: 0.9 }} className="flex w-fit gap-1 self-end rounded-2xl bg-electric-deep/15 px-3.5 py-3">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-electric-deep" style={{ animationDelay: `${d}ms` }} />
                ))}
              </motion.div>
            ) : step >= 3 ? (
              <motion.div
                key="reply"
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-electric-deep px-3.5 py-2.5 text-sm leading-snug text-white"
              >
                Hi Priya! Our cold brew is ₹220, and it&apos;s 10% off this week ☕ Want me to keep one aside for you?
              </motion.div>
            ) : null}
          </AnimatePresence>
          <Appear show={step >= 4} y={4} className="self-end text-[11px] text-ink-soft">
            Sent automatically · in your brand voice
          </Appear>
        </div>
      </Card>
    </div>
  );
}
