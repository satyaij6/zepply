"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import SectionHeader, { Accent } from "./SectionHeader";
import { EASE_OUT, Reveal } from "./anim";

type Billing = "monthly" | "yearly";

/** Prices in rupees per month; yearly is 20% off, billed once a year. */
const PLANS = [
  {
    name: "Creator",
    blurb: "Perfect for individual creators.",
    price: { monthly: 999, yearly: 799 },
    features: ["All core features", "1 social workspace", "Basic analytics", "Email support"],
  },
  {
    name: "Business",
    blurb: "For brands and growing businesses.",
    price: { monthly: 2999, yearly: 2399 },
    features: ["Everything in Creator", "Multiple social accounts", "Advanced analytics", "Priority support"],
    popular: true,
  },
  {
    name: "Business Pro",
    blurb: "For big teams and agencies.",
    price: { monthly: 5999, yearly: 4799 },
    features: ["Everything in Business", "Team seats", "White-label (optional)", "Dedicated support"],
    startingAt: true,
  },
];

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  const toggle = (
    <div role="radiogroup" aria-label="Billing period" className="flex items-center gap-3">
      <div className="flex rounded-full border border-white/10 bg-night-raised p-1">
        {(["monthly", "yearly"] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={billing === b}
            onClick={() => setBilling(b)}
            className={`relative rounded-full px-5 py-2 text-sm font-medium capitalize transition ${billing === b ? "text-night" : "text-zinc-400 hover:text-white"}`}
          >
            {billing === b && <motion.span layoutId="billing-pill" className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.4, ease: EASE_OUT }} />}
            <span className="relative">{b}</span>
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-[#34D399]">Save 20% yearly</span>
    </div>
  );

  return (
    <section id="pricing" className="scroll-mt-28 px-4 pt-32 sm:px-8 lg:px-14 lg:pt-44">
      <div className="mx-auto max-w-[1424px]">
        <SectionHeader
          index="04"
          label="Simple pricing"
          title={
            <>
              Plans for every stage of your <Accent>journey</Accent>.
            </>
          }
          intro="Start free and upgrade as you grow."
          action={toggle}
        />

        <Reveal className="mt-16">
          <ul className="grid overflow-hidden rounded-[32px] border border-white/10 bg-night-raised md:grid-cols-3">
            {PLANS.map(({ name, blurb, price, features, popular, startingAt }) => (
              <li
                key={name}
                className={`relative flex flex-col border-white/10 p-8 not-first:border-t sm:p-10 md:not-first:border-l md:not-first:border-t-0 ${
                  popular ? "bg-linear-to-b from-electric/[0.13] via-electric/[0.04] to-transparent" : ""
                }`}
              >
                {popular && <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-electric to-transparent" />}
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white">{name}</h3>
                  {popular && <span className="rounded-full bg-electric px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                </div>
                <p className="mt-1.5 text-sm text-zinc-400">{blurb}</p>

                <div className="mt-10 flex items-baseline gap-2">
                  <span className="relative inline-flex h-[64px] items-end overflow-hidden">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={billing}
                        className="font-display text-[56px] font-semibold leading-none tracking-[-0.045em] text-white tabular-nums"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -40, opacity: 0 }}
                        transition={{ duration: 0.45, ease: EASE_OUT }}
                      >
                        {rupees(price[billing])}
                        {startingAt && "+"}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="text-sm text-zinc-500">/ month</span>
                </div>
                <p className="mt-2 h-5 text-sm text-zinc-500">{billing === "yearly" ? `Billed yearly at ${rupees(price.yearly * 12)}${startingAt ? "+" : ""}` : "Billed monthly"}</p>

                <a
                  href="#waitlist"
                  className={`mt-8 inline-flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition ${
                    popular
                      ? "bg-electric text-white shadow-[0_0_32px_-6px_rgba(61,126,255,0.7)] ring-1 ring-inset ring-white/20 hover:bg-electric-bright"
                      : "border border-white/15 text-white hover:border-white/40 hover:bg-white/[0.04]"
                  }`}
                >
                  Join the waitlist
                </a>

                <ul className="mt-10 space-y-3.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-[15px] text-zinc-300">
                      <Check className={`h-4 w-4 shrink-0 ${popular ? "text-electric" : "text-zinc-500"}`} strokeWidth={2.2} /> {f}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm text-zinc-500">Every plan starts with a free trial. No credit card required.</p>
        </Reveal>
      </div>
    </section>
  );
}
