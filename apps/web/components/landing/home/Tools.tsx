"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import BrandIcon, { type Brand } from "./BrandIcon";
import SectionHeader, { Accent } from "./SectionHeader";
import { CountUp, EASE_OUT, Reveal, useSeen, useStepper } from "./anim";

export default function Tools() {
  return (
    <section id="tools" className="scroll-mt-28 px-4 pt-32 sm:px-8 lg:px-14 lg:pt-44">
      <div className="mx-auto max-w-[1424px]">
        <SectionHeader
          index="02"
          label="Everything you need"
          title={
            <>
              Powerful tools, in <Accent>one</Accent> platform.
            </>
          }
          intro="Create, publish, engage and measure — everything connected, so you can grow faster."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Tile className="md:col-span-2 lg:col-span-4" visual="h-[360px]" title="DM Automation" body="Auto-reply to Instagram DMs and comments in your brand voice — day or night.">
            <DmVisual />
          </Tile>
          <Tile className="lg:col-span-2" visual="h-[360px]" delay={0.1} title="Growth Analytics" body="Track followers, engagement and real results.">
            <GrowthVisual />
          </Tile>
          <Tile className="lg:col-span-2" visual="h-[250px]" title="Content Studio" body="AI posts, carousels, stories and a 2-week calendar.">
            <StudioVisual />
          </Tile>
          <Tile className="lg:col-span-2" visual="h-[250px]" delay={0.1} title="Clip Engine" body="Turn long videos into viral shorts in one click.">
            <ClipVisual />
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-2" visual="h-[250px]" delay={0.2} title="Auto Posting" body="Schedule to Instagram, Facebook and YouTube.">
            <QueueVisual />
          </Tile>
        </div>
      </div>
    </section>
  );
}

/** Card with a hairline gradient edge and a soft blue spotlight that follows the cursor. */
function Tile({ className, visual, title, body, delay = 0, children }: { className: string; visual: string; title: string; body: string; delay?: number; children: ReactNode }) {
  const track = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };

  return (
    <Reveal className={className} delay={delay}>
      <article onMouseMove={track} className="group relative h-full rounded-[28px] bg-linear-to-b from-white/[0.13] via-white/[0.04] to-white/[0.02] p-px">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[27px] bg-[#0D0D11]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition duration-500 group-hover:opacity-100"
            style={{ background: "radial-gradient(480px circle at var(--x) var(--y), rgba(61,126,255,0.12), transparent 45%)" }}
          />
          <div className={`relative overflow-hidden ${visual}`}>{children}</div>
          <div className="relative mt-auto px-7 pb-7 pt-5">
            <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white">{title}</h3>
            <p className="mt-1.5 max-w-[460px] text-[15px] leading-relaxed text-zinc-400">{body}</p>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

/** Silver product surface that bleeds off the tile's edges. */
const PANEL = "rounded-2xl bg-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]";

/* ── DM Automation: a rule on the left, a conversation that plays itself on the right ── */

type Line = { from: "them" | "us"; text: string } | { typing: true };

const CHAT: Line[] = [
  { from: "them", text: "Hi! Is the weekend brunch on this Sunday?" },
  { typing: true },
  { from: "us", text: "Yes! Sunday brunch runs 10 AM – 2 PM 🍳 Want me to book a table?" },
  { from: "them", text: "Yes please, for 4" },
  { typing: true },
  { from: "us", text: "Done — a table for 4 at 11 AM is held for you. See you Sunday ☕" },
];

function DmVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.4);
  const step = useStepper(seen, CHAT.length, { interval: 1100, loop: true, rest: 4 });
  const shown = CHAT.slice(0, step).filter((line, i) => !("typing" in line) || i === step - 1);

  return (
    <div ref={ref} className="absolute inset-0 grid gap-4 p-7 pb-0 sm:grid-cols-[0.85fr_1.15fr]">
      <div className={`${PANEL} hidden self-start p-5 sm:block`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Brunch enquiries</p>
          <span className="rounded-full bg-[#CFEFE0] px-2 py-0.5 text-[11px] font-semibold text-[#0E8A5F]">Live</span>
        </div>
        <ol className="mt-4 space-y-3 text-sm">
          {[
            ["When", <>someone comments or DMs <b className="font-semibold text-ink">&ldquo;brunch&rdquo;</b></>],
            ["Then", "reply in your brand voice"],
            ["And", "save them as a lead"],
          ].map(([label, text], i) => (
            <li key={i} className="flex gap-3">
              <span className="w-10 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-electric-deep">{label}</span>
              <span className="text-ink-soft">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={`${PANEL} flex flex-col overflow-hidden rounded-b-none`}>
        <div className="flex items-center gap-3 border-b border-paper-line px-5 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FBDDEA] text-[11px] font-semibold text-[#E0337A]">AR</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink">Aditi Rao</p>
            <p className="text-[11px] text-ink-soft">Instagram DM</p>
          </div>
        </div>
        <motion.div layout className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-5 pb-5">
          <AnimatePresence initial={false}>
            {shown.map((line) =>
              "typing" in line ? (
                <motion.div key={`typing-${step}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-fit gap-1 self-end rounded-2xl bg-electric-deep/15 px-3.5 py-3">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-electric-deep" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </motion.div>
              ) : (
                <motion.p
                  key={line.text}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
                    line.from === "us" ? "self-end rounded-br-md bg-electric-deep text-white" : "self-start rounded-bl-md bg-white text-ink shadow-sm"
                  }`}
                >
                  {line.text}
                </motion.p>
              ),
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Growth Analytics: count-up and a line that draws itself ── */

const GROWTH_PATH = "M0 92 L28 84 L56 88 L84 70 L112 76 L140 56 L168 62 L196 40 L224 46 L252 22 L280 10";

function GrowthVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);
  return (
    <div ref={ref} className={`${PANEL} absolute -right-6 bottom-0 left-7 top-7 rounded-b-none rounded-r-none p-6`}>
      <p className="text-sm text-ink-soft">Followers</p>
      <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
        <CountUp to={24812} start={seen} />
      </p>
      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#CFEFE0] px-2 py-0.5 text-xs font-semibold text-[#0E8A5F]">
        <ArrowUp className="h-3 w-3" /> 28% this month
      </span>
      <svg viewBox="0 0 280 100" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[52%] w-full" aria-hidden>
        <defs>
          <linearGradient id="tools-growth" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3D7EFF" stopOpacity="0.3" />
            <stop offset="1" stopColor="#3D7EFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={`${GROWTH_PATH} L280 100 L0 100 Z`}
          fill="url(#tools-growth)"
          initial={{ opacity: 0 }}
          animate={{ opacity: seen ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.8 }}
        />
        <motion.path
          d={GROWTH_PATH}
          fill="none"
          stroke="#2F6BF0"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: seen ? 1 : 0 }}
          transition={{ duration: 1.8, ease: EASE_OUT }}
        />
      </svg>
    </div>
  );
}

/* ── Content Studio: a hand of posts that fans out on hover ── */

const FAN = [
  { src: "/landing/latte.jpg", rest: "-translate-x-[62%] -rotate-[9deg]", hover: "group-hover:-translate-x-[86%] group-hover:-rotate-[14deg]" },
  { src: "/landing/brew.jpg", rest: "translate-x-[62%] rotate-[9deg]", hover: "group-hover:translate-x-[86%] group-hover:rotate-[14deg]" },
  { src: "/landing/space.jpg", rest: "-translate-y-[4%]", hover: "group-hover:-translate-y-[10%]" },
];

function StudioVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {FAN.map(({ src, rest, hover }) => (
        <div key={src} className={`absolute w-[130px] rounded-2xl bg-paper p-1.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)] transition duration-700 ease-out ${rest} ${hover}`}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
            <Image src={src} alt="" fill sizes="130px" className="object-cover" />
          </div>
        </div>
      ))}
      <span className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/15 backdrop-blur">
        <Sparkles className="h-3.5 w-3.5 text-[#7FA8FF]" /> Caption written
      </span>
    </div>
  );
}

/* ── Clip Engine: a playhead scans the video and marks the best moments ── */

const SEGMENTS = [12, 20, 9, 16, 24, 11, 18, 14];
const HIGHLIGHTS = new Set([1, 4, 6]);

function ClipVisual() {
  return (
    <div className={`${PANEL} absolute inset-x-7 bottom-0 top-7 rounded-b-none p-3`}>
      <div className="relative h-[62%] overflow-hidden rounded-xl">
        <Image src="/landing/latte-pour.jpg" alt="" fill sizes="400px" className="object-cover" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">3 viral moments found</span>
      </div>
      <div className="relative mt-3 flex h-9 gap-1 rounded-lg bg-paper-raised p-1">
        {SEGMENTS.map((w, i) => (
          <span key={i} className={`rounded-[5px] ${HIGHLIGHTS.has(i) ? "bg-electric-deep" : "bg-paper-line"}`} style={{ flexGrow: w }} />
        ))}
        <span className="absolute -bottom-1 -top-1 w-0.5 animate-[clip-scan_4s_linear_infinite] rounded-full bg-ink motion-reduce:hidden" />
      </div>
    </div>
  );
}

/* ── Auto Posting: an endless queue of scheduled posts ── */

const QUEUE: { brand: Brand; title: string; when: string }[] = [
  { brand: "instagram", title: "Cold brew launch reel", when: "Today · 6:00 PM" },
  { brand: "youtube", title: "Behind the bar (Short)", when: "Tomorrow · 9:00 AM" },
  { brand: "facebook", title: "Weekend brunch menu", when: "Fri · 11:00 AM" },
  { brand: "instagram", title: "Latte art carousel", when: "Sat · 8:30 AM" },
  { brand: "tiktok", title: "60-second pour-over", when: "Sun · 7:00 PM" },
];

function QueueVisual() {
  return (
    <div className="absolute inset-x-7 inset-y-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]">
      <ul className="animate-[queue-scroll_16s_linear_infinite] space-y-2.5 py-2.5 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...QUEUE, ...QUEUE].map(({ brand, title, when }, i) => (
          <li key={i} aria-hidden={i >= QUEUE.length} className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
            <BrandIcon brand={brand} size={22} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-ink">{title}</p>
              <p className="text-xs text-ink-soft">{when}</p>
            </div>
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
          </li>
        ))}
      </ul>
    </div>
  );
}
