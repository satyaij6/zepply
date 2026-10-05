"use client";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, ChevronLeft, FileText, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import SectionHeader, { Accent } from "./SectionHeader";
import { EASE_OUT, Reveal } from "./anim";

type Case = {
  id: string;
  label: string;
  title: ReactNode;
  body: string;
  points: string[];
  account: { name: string; initials: string; tint: string };
  comment: { user: string; keyword: string };
  reply: string;
  attachment?: { title: string; meta: string };
  quick: string[];
  /** The quick reply the customer taps, and Zepply's confirmation. */
  followUp: { pick: string; confirm: string };
};

const CASES: Case[] = [
  {
    id: "creators",
    label: "Creators",
    title: (
      <>
        Create more. Grow <Accent>faster</Accent>.
      </>
    ),
    body: "Post consistently, engage with your audience and turn followers into opportunities.",
    points: ["A 2-week plan of posts, reels and carousels", "Keyword comments turn into DMs with your link", "Every reply sounds like you"],
    account: { name: "Ananya Fit", initials: "AF", tint: "bg-[#FBDDEA] text-[#E0337A]" },
    comment: { user: "meera.k", keyword: "PLAN" },
    reply: "Hey Meera! Here's the free 7-day home workout plan you asked for 💪",
    attachment: { title: "7-Day Home Workout Plan", meta: "PDF · Free" },
    quick: ["Start Day 1", "Coaching info"],
    followUp: { pick: "Start Day 1", confirm: "Day 1 is a 20-minute full-body warm-up 💪 I'll check in tomorrow with Day 2!" },
  },
  {
    id: "cafes",
    label: "Cafés & restaurants",
    title: (
      <>
        Fill more <Accent>tables</Accent>.
      </>
    ),
    body: "Answer menu, timing and booking questions the moment they come in.",
    points: ["Menu and timings sent on request", "Table bookings straight from DMs", "Weekly specials posted on schedule"],
    account: { name: "Brew House", initials: "BH", tint: "bg-[#F3E3D3] text-[#8A5A2B]" },
    comment: { user: "rahul_eats", keyword: "MENU" },
    reply: "Hi Rahul! Here's today's menu ☕ Shall I hold a table for you this evening?",
    attachment: { title: "Brew House — Menu", meta: "Updated today" },
    quick: ["Table for 2", "Table for 4"],
    followUp: { pick: "Table for 2", confirm: "Booked! A table for 2 at 7:30 PM is held for you. See you tonight ☕" },
  },
  {
    id: "gyms",
    label: "Gyms & studios",
    title: (
      <>
        Turn followers into <Accent>members</Accent>.
      </>
    ),
    body: "Capture trial sign-ups from every post, reel and story.",
    points: ["Free-trial passes sent automatically", "Class schedules on request", "Every lead saved for your front desk"],
    account: { name: "Iron Republic", initials: "IR", tint: "bg-[#DCE6FA] text-electric-deep" },
    comment: { user: "karthik.runs", keyword: "TRIAL" },
    reply: "Welcome Karthik! Here's your free 3-day pass 🏋️ Which branch suits you best?",
    quick: ["Kondapur", "Gachibowli"],
    followUp: { pick: "Kondapur", confirm: "Great choice! Your pass is active at Kondapur from tomorrow, 6 AM 🏋️" },
  },
  {
    id: "realestate",
    label: "Real estate",
    title: (
      <>
        Answer every <Accent>enquiry</Accent>, instantly.
      </>
    ),
    body: "Share brochures and book site visits while the buyer is still interested.",
    points: ["Brochures and floor plans on request", "Site visits booked from DMs", "Every lead captured with contact details"],
    account: { name: "Green Meadows", initials: "GM", tint: "bg-[#CFEFE0] text-[#0E8A5F]" },
    comment: { user: "sneha.homes", keyword: "PRICE" },
    reply: "Hi Sneha! Here's the brochure and price sheet for Green Meadows 🏡 Shall I book a site visit this weekend?",
    attachment: { title: "Green Meadows — Brochure", meta: "PDF · 12 pages" },
    quick: ["Saturday", "Sunday"],
    followUp: { pick: "Saturday", confirm: "Site visit booked for Saturday, 11 AM. Our advisor will call to confirm 🏡" },
  },
];

const AUTOPLAY_MS = 8000;

export default function UseCases() {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const visible = useInView(panel, { amount: 0.4 });
  const current = CASES[index];

  // Rotate through the cases while the panel is on screen, until the visitor picks one
  useEffect(() => {
    if (!autoplay || !visible) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % CASES.length), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [autoplay, visible, index]);

  const pick = (i: number) => {
    setAutoplay(false);
    setIndex(i);
  };

  return (
    <section id="use-cases" className="scroll-mt-28 px-4 pt-32 sm:px-8 lg:px-14 lg:pt-40">
      <div className="mx-auto max-w-[1424px]">
        <SectionHeader
          index="03"
          label="Built for real people"
          title={
            <>
              Works for <Accent>creators</Accent> and businesses.
            </>
          }
          intro="Whether you're an individual creator or a growing business, Zepply adapts to your goals."
        />

        <Reveal className="mt-16">
          <div ref={panel} className="overflow-hidden rounded-[32px] border border-white/10 bg-night-raised">
            <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="flex flex-col p-7 sm:p-12">
                <div role="tablist" aria-label="Who it's for" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  {CASES.map((c, i) => (
                    <button
                      key={c.id}
                      role="tab"
                      type="button"
                      aria-selected={i === index}
                      onClick={() => pick(i)}
                      className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${i === index ? "text-night" : "text-zinc-400 hover:text-white"}`}
                    >
                      {i === index && <motion.span layoutId="case-pill" className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.45, ease: EASE_OUT }} />}
                      <span className="relative">{c.label}</span>
                      {/* Time left before the next case, while autoplay runs */}
                      {i === index && autoplay && visible && (
                        <span className="absolute inset-x-4 bottom-1 h-0.5 overflow-hidden rounded-full">
                          <motion.span
                            key={`progress-${index}`}
                            className="block h-full bg-electric"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
                          />
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Copy sits centred in the space under the tabs, level with the phone */}
                <div className="my-auto pt-12">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={current.id}
                      role="tabpanel"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4, ease: EASE_OUT }}
                    >
                      <h3 className="font-display text-[clamp(32px,3.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.028em] text-balance text-white">{current.title}</h3>
                      <p className="mt-4 max-w-[460px] text-base leading-relaxed text-zinc-400 sm:text-lg">{current.body}</p>
                      <ol className="mt-10 border-b border-white/10">
                        {current.points.map((p, i) => (
                          <li key={p} className="flex items-baseline gap-5 border-t border-white/10 py-4 text-[15px] text-zinc-200">
                            <span className="font-serif text-lg italic text-zinc-500">0{i + 1}</span>
                            {p}
                          </li>
                        ))}
                      </ol>
                    </motion.div>
                  </AnimatePresence>

                  <a href="#waitlist" className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-medium text-white transition hover:gap-3">
                    Join the waitlist <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="relative flex items-center justify-center overflow-hidden border-t border-white/10 bg-[#0A0A0D] px-6 py-14 lg:border-l lg:border-t-0">
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
                <div aria-hidden className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/20 blur-[100px]" />
                <div className="relative flex flex-col items-center gap-5">
                  <Phone current={current} />
                  <p className="text-xs text-zinc-500">Sent automatically by Zepply</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** A phone showing the comment-to-DM flow for the selected case. */
function Phone({ current }: { current: Case }) {
  const { account, comment, reply, attachment, quick, followUp } = current;
  // The customer taps a quick reply after the options appear, then Zepply confirms
  const pickAt = attachment ? 2.2 : 1.8;
  const item = (delay: number) => ({
    initial: { opacity: 0, y: 12, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.45, delay, ease: EASE_OUT },
  });

  return (
    <div className="relative w-[290px] sm:w-[310px]">
      <div className="rounded-[46px] border border-white/15 bg-[#1A1A20] p-2.5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]">
        <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[37px] bg-paper">
          <span aria-hidden className="absolute left-1/2 top-2.5 h-6 w-24 -translate-x-1/2 rounded-full bg-[#1A1A20]" />

          <div className="flex items-center gap-3 border-b border-paper-line px-4 pb-3 pt-12">
            <ChevronLeft className="h-5 w-5 text-ink" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={account.name} className="flex items-center gap-2.5" {...item(0)}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${account.tint}`}>{account.initials}</span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-ink">{account.name}</p>
                  <p className="text-[11px] text-ink-soft">Business account</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={current.id} exit={{ opacity: 0, transition: { duration: 0.2 } }} className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-3.5 py-4">
              <motion.div {...item(0.1)} className="mx-auto flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] text-ink-soft shadow-sm">
                <MessageCircle className="h-3.5 w-3.5" />@{comment.user} commented <b className="font-semibold text-ink">&ldquo;{comment.keyword}&rdquo;</b>
              </motion.div>

              <motion.p {...item(0.6)} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-electric-deep px-3.5 py-2.5 text-[13px] leading-snug text-white">
                {reply}
              </motion.p>

              {attachment && (
                <motion.div {...item(1)} className="flex max-w-[85%] items-center gap-3 self-end rounded-2xl bg-white p-3 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-wash text-electric-deep">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[13px] font-semibold text-ink">{attachment.title}</p>
                    <p className="text-[11px] text-ink-soft">{attachment.meta}</p>
                  </div>
                </motion.div>
              )}

              <motion.div {...item(attachment ? 1.4 : 1)} className="flex flex-wrap justify-end gap-1.5">
                {quick.map((q) => (
                  <motion.span
                    key={q}
                    initial={false}
                    animate={q === followUp.pick ? { scale: [1, 0.92, 1] } : undefined}
                    transition={{ duration: 0.3, delay: pickAt - 0.3 }}
                    className="rounded-full border border-electric-deep/40 bg-white px-3 py-1.5 text-xs font-medium text-electric-deep"
                  >
                    {q}
                  </motion.span>
                ))}
              </motion.div>

              <motion.p {...item(pickAt)} className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] text-ink shadow-sm">
                {followUp.pick}
              </motion.p>

              <motion.p {...item(pickAt + 0.8)} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-electric-deep px-3.5 py-2.5 text-[13px] leading-snug text-white">
                {followUp.confirm}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          <div className="mx-3.5 mb-5 rounded-full border border-paper-line bg-white px-4 py-2.5 text-xs text-ink-soft">Message…</div>
        </div>
      </div>
    </div>
  );
}
