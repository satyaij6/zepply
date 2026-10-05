"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Play, Sparkles } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import BrandIcon, { type Brand } from "./BrandIcon";
import SectionHeader, { Accent } from "./SectionHeader";
import { CountUp, EASE_OUT, Reveal, useSeen, useStepper } from "./anim";

/*
 * Three rows of deliberately uneven tiles: DM Automation (wide) + Growth,
 * Content Studio + Clip Engine side by side, then Auto Posting as a full-width
 * band. Each tile's picture is a live, silver product mock-up.
 */

export default function Tools() {
  return (
    <section id="tools" className="scroll-mt-28 px-4 pt-32 sm:px-8 lg:px-14 lg:pt-48">
      <div className="mx-auto max-w-[1424px]">
        <SectionHeader
          align="center"
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
          <Tile className="md:col-span-2 lg:col-span-4" visual="h-[420px]" title="DM Automation" body="Auto-reply to Instagram DMs and comments in your brand voice — day or night.">
            <DmVisual />
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-2" visual="h-[420px]" delay={0.1} title="Growth Analytics" body="Track followers, engagement and real results.">
            <GrowthVisual />
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-3" visual="h-[320px]" title="Content Studio" body="AI posts, carousels, stories and a 2-week calendar — written in your voice.">
            <StudioVisual />
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-3" visual="h-[320px]" delay={0.1} title="Clip Engine" body="Turn long videos into viral shorts in one click.">
            <ClipVisual />
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-6" visual="h-[200px] lg:h-auto" side title="Auto Posting" body="Schedule to Instagram, Facebook and YouTube at the times your audience is online.">
            <QueueVisual />
          </Tile>
        </div>
      </div>
    </section>
  );
}

/**
 * Card with a hairline gradient edge and a soft blue spotlight that follows the cursor.
 * `side` puts the text on the left and the picture on the right (for the full-width band).
 */
function Tile({
  className,
  visual,
  title,
  body,
  delay = 0,
  side = false,
  children,
}: {
  className: string;
  visual: string;
  title: string;
  body: string;
  delay?: number;
  side?: boolean;
  children: ReactNode;
}) {
  const track = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };

  return (
    <Reveal className={className} delay={delay}>
      <article onMouseMove={track} className="group relative h-full rounded-[28px] bg-linear-to-b from-white/[0.13] via-white/[0.04] to-white/[0.02] p-px">
        <div className={`relative flex h-full flex-col overflow-hidden rounded-[27px] bg-[#0D0D11] ${side ? "lg:flex-row-reverse" : ""}`}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition duration-500 group-hover:opacity-100"
            style={{ background: "radial-gradient(480px circle at var(--x) var(--y), rgba(61,126,255,0.12), transparent 45%)" }}
          />
          {/* Pictures that bleed off the bottom fade into the tile instead of stopping on a hard edge */}
          <div className={`relative overflow-hidden ${visual} ${side ? "lg:min-h-[220px] lg:flex-1" : "[mask-image:linear-gradient(to_bottom,black_72%,transparent)]"}`}>{children}</div>
          <div className={`relative mt-auto px-7 pb-8 pt-6 ${side ? "lg:my-auto lg:w-[400px] lg:shrink-0 lg:py-10 lg:pl-10" : ""}`}>
            <h3 className="font-display text-2xl font-semibold tracking-[-0.025em] text-white">{title}</h3>
            <p className="mt-2 max-w-[460px] text-base leading-relaxed text-zinc-400">{body}</p>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

/** Silver product surface; tiles let it bleed off their edges. */
const PANEL = "rounded-2xl bg-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]";

/* ── DM Automation: the rule and today's numbers on the left, a conversation that plays itself on the right ── */

type Line = { from: "them" | "us"; text: string } | { typing: true };

const CHAT: Line[] = [
  { from: "them", text: "Hi! Is the weekend brunch on this Sunday?" },
  { typing: true },
  { from: "us", text: "Yes! Sunday brunch runs 10 AM – 2 PM 🍳 Want me to book a table?" },
  { from: "them", text: "Yes please, for 4" },
  { typing: true },
  { from: "us", text: "Done — a table for 4 at 11 AM is held for you. See you Sunday ☕" },
];

const TODAY = [
  ["142", "replies sent"],
  ["38", "leads saved"],
  ["2s", "avg. reply"],
];

function DmVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.4);
  const step = useStepper(seen, CHAT.length, { interval: 1100, loop: true, rest: 4 });
  const shown = CHAT.slice(0, step).filter((line, i) => !("typing" in line) || i === step - 1);

  return (
    <div ref={ref} className="absolute inset-0 grid gap-4 p-7 pb-0 sm:grid-cols-[0.85fr_1.15fr]">
      <div className="hidden flex-col gap-4 sm:flex">
        <div className={`${PANEL} p-5`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Brunch enquiries</p>
            <span className="flex items-center gap-1.5 rounded-full bg-[#CFEFE0] px-2 py-0.5 text-[11px] font-semibold text-[#0E8A5F]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0E9F6E]" /> Live
            </span>
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
        <div className={`${PANEL} grid grid-cols-3 divide-x divide-paper-line`}>
          {TODAY.map(([value, label]) => (
            <div key={label} className="px-4 py-4">
              <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
        <p className="px-1 text-xs text-zinc-500">Today, across all accounts</p>
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

/* ── Growth Analytics: count-up and a line that draws itself across the tile ── */

const GROWTH_POINTS: [number, number][] = [
  [0, 92], [28, 84], [56, 88], [84, 70], [112, 76], [140, 56], [168, 62], [196, 40], [224, 46], [252, 22], [280, 8],
];
const GROWTH_PATH = GROWTH_POINTS.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

function GrowthVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);
  return (
    <div ref={ref} className={`${PANEL} absolute -right-px bottom-0 left-7 top-7 flex flex-col rounded-b-none rounded-r-none`}>
      <div className="flex items-start justify-between p-6 pb-0">
        <div>
          <p className="text-sm text-ink-soft">Followers</p>
          <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
            <CountUp to={24812} start={seen} />
          </p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#CFEFE0] px-2 py-0.5 text-xs font-semibold text-[#0E8A5F]">
            <ArrowUp className="h-3 w-3" /> 28% this month
          </span>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft ring-1 ring-paper-line">Last 30 days</span>
      </div>
      <svg viewBox="0 0 280 100" preserveAspectRatio="none" className="mt-6 w-full flex-1" aria-hidden>
        <defs>
          <linearGradient id="tools-growth" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3D7EFF" stopOpacity="0.32" />
            <stop offset="1" stopColor="#3D7EFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((y) => (
          <line key={y} x1="0" x2="280" y1={y} y2={y} stroke="#D9DCE6" strokeWidth="0.5" strokeDasharray="2 3" />
        ))}
        <motion.path d={`${GROWTH_PATH} L280 100 L0 100 Z`} fill="url(#tools-growth)" initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={{ duration: 1, delay: 0.9 }} />
        <motion.path
          d={GROWTH_PATH}
          fill="none"
          stroke="#2F6BF0"
          strokeWidth="1.6"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: seen ? 1 : 0 }}
          transition={{ duration: 1.8, ease: EASE_OUT }}
        />
      </svg>
    </div>
  );
}

/* ── Content Studio: a hand of posts that fans out on hover, beside the caption it wrote ── */

const FAN = [
  { src: "/landing/latte.jpg", rest: "-translate-x-[46%] -rotate-[9deg]", hover: "group-hover:-translate-x-[62%] group-hover:-rotate-[13deg]" },
  { src: "/landing/brew.jpg", rest: "translate-x-[46%] rotate-[9deg]", hover: "group-hover:translate-x-[62%] group-hover:rotate-[13deg]" },
  { src: "/landing/space.jpg", rest: "-translate-y-[4%]", hover: "group-hover:-translate-y-[10%]" },
];

function StudioVisual() {
  return (
    <div className="absolute inset-0 grid sm:grid-cols-[1fr_1.15fr]">
      <div className="relative flex items-center justify-center">
        {FAN.map(({ src, rest, hover }) => (
          <div key={src} className={`absolute w-[108px] rounded-2xl bg-paper p-1.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)] transition duration-700 ease-out ${rest} ${hover}`}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
              <Image src={src} alt="" fill sizes="120px" className="object-cover" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden items-end pr-7 pt-7 sm:flex">
        <div className={`${PANEL} w-full rounded-b-none p-5`}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-electric-deep" /> AI caption
            </p>
            <span className="rounded-full bg-electric-wash px-2 py-0.5 text-[11px] font-medium text-electric-deep">Brand voice</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink">Slow mornings, strong coffee. ☕ Our new cold brew lands this Friday.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["#coldbrew", "#hyderabadcafe", "#slowmornings"].map((t) => (
              <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-paper-line">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 border-t border-paper-line pt-3 text-xs text-ink-soft">
            <BrandIcon brand="instagram" size={14} /> Scheduled · Fri 9:00 AM
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Clip Engine: a playhead scans the video, and the shorts it found line up beside it ── */

const SEGMENTS = [12, 20, 9, 16, 24, 11, 18, 14];
const HIGHLIGHTS = new Set([1, 4, 6]);
const CLIPS = [
  { src: "/landing/latte-pour.jpg", length: "0:24" },
  { src: "/landing/brew.jpg", length: "0:31" },
  { src: "/landing/latte.jpg", length: "0:18" },
];

function ClipVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="absolute inset-0 grid gap-4 p-7 pb-0 sm:grid-cols-[1.4fr_1fr]">
      <div className={`${PANEL} self-end rounded-b-none p-3`}>
        <div className="relative aspect-video overflow-hidden rounded-xl">
          <Image src="/landing/space.jpg" alt="" fill sizes="400px" className="object-cover" />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">Full video · 18:42</span>
        </div>
        <div className="relative mt-3 mb-1 flex h-9 gap-1 rounded-lg bg-paper-raised p-1">
          {SEGMENTS.map((w, i) => (
            <span key={i} className={`rounded-[5px] ${HIGHLIGHTS.has(i) ? "bg-electric-deep" : "bg-paper-line"}`} style={{ flexGrow: w }} />
          ))}
          <span className="absolute -bottom-1 -top-1 w-0.5 animate-[clip-scan_4s_linear_infinite] rounded-full bg-ink motion-reduce:hidden" />
        </div>
      </div>
      <div className="hidden grid-cols-3 gap-2 self-center sm:grid">
        {CLIPS.map(({ src, length }, i) => (
          <motion.div
            key={src}
            className="relative aspect-[9/16] overflow-hidden rounded-xl ring-1 ring-white/15"
            initial={false}
            animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.15, ease: EASE_OUT }}
          >
            <Image src={src} alt="" fill sizes="90px" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/70" />
            <Play className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 fill-white text-white" />
            <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold text-white">{length}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Auto Posting: scheduled posts glide past in an endless line ── */

const QUEUE: { brand: Brand; src: string; title: string; when: string }[] = [
  { brand: "instagram", src: "/landing/latte-pour.jpg", title: "Cold brew launch reel", when: "Today · 6:00 PM" },
  { brand: "youtube", src: "/landing/brew.jpg", title: "Behind the bar (Short)", when: "Tomorrow · 9:00 AM" },
  { brand: "facebook", src: "/landing/space.jpg", title: "Weekend brunch menu", when: "Fri · 11:00 AM" },
  { brand: "instagram", src: "/landing/latte.jpg", title: "Latte art carousel", when: "Sat · 8:30 AM" },
  { brand: "tiktok", src: "/landing/cafe-day.jpg", title: "60-second pour-over", when: "Sun · 7:00 PM" },
];

function QueueVisual() {
  return (
    <div className="absolute inset-0 flex items-center overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <ul className="flex w-max animate-[queue-slide_32s_linear_infinite] gap-3 pr-3 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...QUEUE, ...QUEUE].map(({ brand, src, title, when }, i) => (
          <li key={i} aria-hidden={i >= QUEUE.length} className={`${PANEL} flex w-[270px] shrink-0 items-center gap-3 p-3`}>
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <Image src={src} alt="" fill sizes="48px" className="object-cover" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-ink">{title}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{when}</p>
            </div>
            <BrandIcon brand={brand} size={18} className="ml-auto shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
