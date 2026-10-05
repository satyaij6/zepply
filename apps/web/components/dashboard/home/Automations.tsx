"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Plus } from "lucide-react";
import { useState } from "react";
import type { HomeAutomation, HomeData } from "@/types/dashboard";
import { Card, CardHeader, KIND, number } from "./ui";

/** The user's automations with on/off switches (PATCH /api/triggers/[id] flips isActive). */
export function Automations({ data, demo }: { data: HomeData; demo: boolean }) {
  const [items, setItems] = useState(data.automations);
  // Server total, adjusted for any switches flipped here (only the top 5 are listed)
  const active = data.totals.activeAutomations - data.automations.filter((a) => a.isActive).length + items.filter((a) => a.isActive).length;

  const toggle = async (id: string) => {
    const flip = (list: HomeAutomation[]) => list.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a));
    setItems(flip);
    if (demo) return;
    const res = await fetch(`/api/triggers/${id}`, { method: "PATCH" }).catch(() => null);
    if (!res?.ok) setItems(flip); // put it back
  };

  return (
    <Card className="flex flex-col p-6">
      <CardHeader
        title="Automations"
        aside={items.length > 0 && <span className="rounded-full bg-[#E3F5EC] px-2 py-0.5 text-xs font-semibold text-[#0E8A5F]">{active} active</span>}
      >
        {items.length > 0 && <ViewAll href="/dashboard/triggers" />}
      </CardHeader>

      {items.length === 0 ? (
        <Empty title="No automations yet" body="Reply to comments and DMs automatically, in your brand voice.">
          <Link href="/dashboard/triggers/new" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-app-ink px-4 text-sm font-semibold text-white transition hover:bg-black">
            <Plus className="h-4 w-4" /> Create automation
          </Link>
        </Empty>
      ) : (
        <ul className="mt-3 divide-y divide-app-line">
          {items.map((a) => {
            const { label, icon: Icon } = KIND[a.type];
            return (
              <li key={a.id} className="flex items-center gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/triggers/${a.id}`} className="block truncate text-[15px] font-semibold transition hover:text-electric-deep">
                    {a.name || `${label} automation`}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-app-muted">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                    {a.keywords.slice(0, 2).map((k) => (
                      <span key={k} className="rounded-md bg-app-bg px-1.5 py-0.5 font-medium text-app-ink">
                        {k}
                      </span>
                    ))}
                  </p>
                </div>
                <p className="text-right text-xs text-app-muted">
                  <span className="block font-display text-base font-semibold text-app-ink tabular-nums">{number(a.hitCount)}</span>
                  fired
                </p>
                <Switch on={a.isActive} label={`${a.isActive ? "Pause" : "Turn on"} ${a.name || label}`} onClick={() => toggle(a.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-electric" : "bg-[#D9D6CE]"}`}>
      <motion.span className="h-5 w-5 rounded-full bg-white shadow" initial={false} animate={{ x: on ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
    </button>
  );
}

export function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-electric-deep transition hover:gap-1.5">
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-app-muted">{body}</p>
      {children}
    </div>
  );
}
