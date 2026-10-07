"use client";

import { AtSign, Check, FileText, LayoutDashboard, Palette } from "lucide-react";
import type { ReactNode } from "react";
import { HandNote, Nav } from "./ui";
import { imageUrl } from "./StepContent";
import type { Draft } from "@prisma/client";

type DraftJson = Omit<Draft, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

export function StepDone({
  path,
  instagram,
  drafts,
  onBack,
  onFinish,
  busy,
  error,
}: {
  path: string | null;
  instagram: string | null;
  drafts: DraftJson[];
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div>
        <p className="text-sm font-semibold text-electric">🎉 All set!</p>
        <h1 className="mt-2 font-display text-[clamp(34px,3.8vw,52px)] font-semibold leading-[1.02] tracking-[-0.035em] text-app-ink">
          Your Zepply workspace <em className="font-serif font-normal italic">is ready.</em>
        </h1>
        <p className="mt-3 max-w-[480px] text-base leading-relaxed text-app-muted">Everything is set up from your answers. Next: create, reply and grow.</p>

        <ul className="mt-6 space-y-2.5">
          <Row icon={<Palette className="h-5 w-5" />} tint="bg-violet-100 text-violet-700" title={path === "creator" ? "Your style is saved" : "Your brand is ready"} sub={path === "creator" ? "Profile photo, colours, voice and audience are saved." : "Logo, colours, voice and audience are saved."} done />
          <Row
            icon={<AtSign className="h-5 w-5" />}
            tint="bg-pink-100 text-pink-600"
            title={instagram ? "Instagram connected" : "Instagram not connected yet"}
            sub={instagram ? `@${instagram} is linked to Zepply.` : "Connect it from your dashboard to start replying."}
            done={!!instagram}
          />
          <Row icon={<FileText className="h-5 w-5" />} tint="bg-sky-100 text-sky-700" title={`${drafts.length} sample posts written`} sub="Ready to edit, copy and post." done={drafts.length > 0} />
          <Row icon={<LayoutDashboard className="h-5 w-5" />} tint="bg-emerald-100 text-emerald-700" title="Your workspace is set up" sub="Your dashboard is waiting." done />
        </ul>

        <Nav onBack={onBack} onNext={onFinish} nextLabel="Enter my workspace" busy={busy} error={error} />
        <p className="mt-3 text-sm text-app-faint">You can change any of this later in Settings and Brand Kit.</p>
      </div>

      <div className="relative hidden h-[480px] lg:block">
        <HandNote className="absolute right-6 top-0 -rotate-3">Here are your sample posts ↓</HandNote>
        {drafts.slice(0, 3).map((d, i) => (
          <div
            key={d.id}
            className="absolute top-12 w-[196px] overflow-hidden rounded-3xl border-4 border-white bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.45)]"
            style={{ left: `${i * 33}%`, transform: `rotate(${(i - 1) * 6}deg) translateY(${i === 1 ? -12 : 18}px)`, zIndex: i === 1 ? 2 : 1 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(d)} alt={d.headline} className="aspect-[4/5] w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ icon, tint, title, sub, done }: { icon: ReactNode; tint: string; title: string; sub: string; done: boolean }) {
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-app-line bg-app-card px-4 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-app-ink">{title}</span>
        <span className="block text-sm text-app-muted">{sub}</span>
      </span>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "border-2 border-app-line"}`}>
        {done && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
    </li>
  );
}
