"use client";

import Image from "next/image";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  Clapperboard,
  Coffee,
  Dumbbell,
  Ellipsis,
  GraduationCap,
  Heart,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Mic,
  Package,
  Scissors,
  ShoppingBag,
  Stethoscope,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { GOAL_EXAMPLES, goalsFor, nichesFor, type Path } from "@/lib/onboarding/options";
import { Choice, Eyebrow, Field, HandNote, Lede, Nav, SectionLabel, Title, inputClass } from "./ui";

const ICONS: Record<string, ReactNode> = {
  "personal-brand": <User className="h-[18px] w-[18px]" />,
  education: <GraduationCap className="h-[18px] w-[18px]" />,
  podcast: <Mic className="h-[18px] w-[18px]" />,
  coaching: <Users className="h-[18px] w-[18px]" />,
  entertainment: <Clapperboard className="h-[18px] w-[18px]" />,
  other: <Ellipsis className="h-[18px] w-[18px]" />,
  "cafe-restaurant": <Coffee className="h-[18px] w-[18px]" />,
  retail: <ShoppingBag className="h-[18px] w-[18px]" />,
  clinic: <Stethoscope className="h-[18px] w-[18px]" />,
  fitness: <Dumbbell className="h-[18px] w-[18px]" />,
  "real-estate": <Building2 className="h-[18px] w-[18px]" />,
  d2c: <Package className="h-[18px] w-[18px]" />,
  services: <Scissors className="h-[18px] w-[18px]" />,
  "grow-followers": <TrendingUp className="h-[18px] w-[18px]" />,
  "more-reach": <BarChart3 className="h-[18px] w-[18px]" />,
  "post-consistently": <CalendarDays className="h-[18px] w-[18px]" />,
  "more-engagement": <Heart className="h-[18px] w-[18px]" />,
  "more-leads": <MessageCircle className="h-[18px] w-[18px]" />,
  "more-bookings": <CalendarCheck className="h-[18px] w-[18px]" />,
  "sell-more": <ShoppingBag className="h-[18px] w-[18px]" />,
  "reply-faster": <Megaphone className="h-[18px] w-[18px]" />,
};

export type About = { name: string; niche: string | null; goals: string[]; brandName: string; location: string };

export function StepAbout({
  path,
  value,
  onChange,
  onBack,
  onNext,
  busy,
  error,
}: {
  path: Path;
  value: About;
  onChange: (next: Partial<About>) => void;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  error: string | null;
}) {
  const business = path === "business";
  const niches = nichesFor(path);
  const goals = goalsFor(path);
  const ready = value.name.trim() && value.niche && value.goals.length > 0 && (!business || value.brandName.trim());
  const toggleGoal = (g: string) => onChange({ goals: value.goals.includes(g) ? value.goals.filter((x) => x !== g) : [...value.goals, g] });

  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <Eyebrow step={2} />
        <Title accent="like yours.">Let&apos;s make Zepply feel</Title>
        <Lede>{business ? "Tell us about your business so everything we make fits it." : "Tell us a bit about you so we can create content that fits your goals."}</Lede>

        <div className={`mt-6 grid gap-4 ${business ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Field label="What's your name?" htmlFor="ob-name">
            <input id="ob-name" className={inputClass} value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Your name" maxLength={60} autoComplete="name" />
          </Field>
          {business && (
            <Field label="What's your business called?" htmlFor="ob-brand">
              <input id="ob-brand" className={inputClass} value={value.brandName} onChange={(e) => onChange({ brandName: e.target.value })} placeholder="e.g. The Brew House" maxLength={60} autoComplete="organization" />
            </Field>
          )}
          {business && (
            <Field label="Where are you based?" htmlFor="ob-city">
              <input id="ob-city" className={inputClass} value={value.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="City, e.g. Hyderabad" maxLength={60} autoComplete="address-level2" />
            </Field>
          )}
        </div>

        <div className="mt-6">
          <SectionLabel note="Pick one">{business ? "What kind of business?" : "What do you create?"}</SectionLabel>
          <div role="radiogroup" className={`grid gap-2.5 sm:grid-cols-2 ${business ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {niches.map((n) => (
              <Choice key={n.value} selected={value.niche === n.value} onClick={() => onChange({ niche: n.value })} title={n.label} hint={n.hint} icon={ICONS[n.value]} />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <SectionLabel note="Pick one or more">What do you want from Zepply?</SectionLabel>
          <div className={`grid gap-2.5 sm:grid-cols-2 ${business ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {goals.map((g) => (
              <Choice key={g.value} multi selected={value.goals.includes(g.value)} onClick={() => toggleGoal(g.value)} title={g.label} hint={g.hint} icon={ICONS[g.value]} />
            ))}
          </div>
        </div>

        <Nav onBack={onBack} onNext={onNext} disabled={!ready} busy={busy} error={error} />
      </div>

      <aside className="hidden lg:block">
        <div>
          <HandNote className="ml-auto max-w-[220px] -rotate-6 text-right">We&apos;ll tailor ideas to your niche ↓</HandNote>
          <Collage business={business} label={niches.find((n) => n.value === value.niche)?.label ?? (business ? "Your business" : "Your content")} />
          <div className="mt-4 rounded-3xl border border-app-line bg-app-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-electric-wash text-electric">
                <Lightbulb className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-app-ink">What Zepply will make for you</h3>
            </div>
            <ul className="mt-3 space-y-2.5">
              {(value.goals.length ? value.goals : goals.slice(0, 3).map((g) => g.value)).map((g) => (
                <li key={g} className={`flex items-start gap-3 text-sm ${value.goals.length ? "text-app-ink" : "text-app-faint"}`}>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-electric-wash text-electric">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {GOAL_EXAMPLES[g]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

const TILE_TEXT = {
  creator: ["A day in my life", "Turning ideas into opportunities", "Tips that actually work"],
  business: ["Fresh from our kitchen", "Your new favourite spot", "Behind the counter"],
};

/** Three tilted post tiles with the chosen niche as a label */
function Collage({ label, business }: { label: string; business: boolean }) {
  const text = TILE_TEXT[business ? "business" : "creator"];
  const tiles = [
    { src: "/landing/space.jpg", text: text[0], views: "48K", cls: "left-0 top-10 -rotate-[8deg]" },
    { src: "/landing/latte.jpg", text: text[1], views: "124K", cls: "left-[118px] top-0 z-10" },
    { src: "/landing/brew.jpg", text: text[2], views: "92K", cls: "left-[236px] top-10 z-20 rotate-[8deg]" },
  ];
  return (
    <div className="relative mt-7 h-[245px]">
      {tiles.map((t) => (
        <div key={t.src} className={`absolute h-[210px] w-[120px] overflow-hidden rounded-2xl shadow-[0_20px_40px_-20px_rgba(0,0,0,0.55)] ${t.cls}`}>
          <Image src={t.src} alt="" fill sizes="160px" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
          <p className="absolute bottom-8 left-3 right-3 font-display text-[15px] font-semibold leading-tight text-white">{t.text}</p>
          <p className="absolute bottom-3 left-3 text-[11px] font-semibold text-white/90">▶ {t.views}</p>
        </div>
      ))}
      <span className="absolute left-[178px] top-0 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-app-card px-3 py-1.5 text-xs font-semibold text-app-ink shadow-md ring-1 ring-app-line">
        {label}
      </span>
    </div>
  );
}
