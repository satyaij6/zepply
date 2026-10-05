"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import SectionHeader, { Accent } from "./SectionHeader";
import { EASE_OUT, Reveal } from "./anim";

const CONTACT_EMAIL = "contact@buybloc.com";

const FAQS = [
  {
    q: "What social platforms does Zepply support?",
    a: "Zepply supports Instagram, YouTube, TikTok, Facebook, WhatsApp and X (Twitter).",
  },
  {
    q: "Do I need a credit card to join the waitlist?",
    a: "No. Joining the waitlist only takes your email address, and every plan starts with a free trial.",
  },
  {
    q: "Can I use Zepply for my business?",
    a: "Yes. Zepply works for individual creators and for businesses like cafés, gyms and real-estate teams. The Business and Business Pro plans add more social accounts, advanced analytics and team seats.",
  },
  {
    q: "When will Zepply launch?",
    a: "We're in private beta and inviting people from the waitlist in small batches. Join the waitlist to get your invite.",
  },
  {
    q: "Is Zepply safe to use with my Instagram account?",
    a: "Yes. Zepply is built on Meta's official Instagram API. No bots, fake sessions or scraping.",
  },
  {
    q: "Will my followers know replies are automated?",
    a: "Not unless you want them to. Replies are written in your brand voice and sent at the right moment.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-28 px-4 pt-32 sm:px-8 lg:px-14 lg:pt-44">
      <div className="mx-auto grid max-w-[1424px] gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeader
            index="05"
            label="Questions"
            title={
              <>
                Everything you need to <Accent>know</Accent>.
              </>
            }
          />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[380px] text-base leading-relaxed text-zinc-400">
              Can&apos;t find your answer? Write to us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <ul className="border-b border-white/10">
            {FAQS.map(({ q, a }, i) => {
              const isOpen = open === i;
              return (
                <li key={q} className="border-t border-white/10">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium tracking-[-0.01em] text-white sm:text-xl"
                  >
                    {q}
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition duration-300 ${isOpen ? "rotate-45 border-white bg-white text-night" : "border-white/15 text-zinc-400"}`}>
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[620px] pb-7 pr-14 text-base leading-relaxed text-zinc-400">{a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
