import type { ReactNode } from "react";
import { Reveal } from "./anim";

/** Section opener: a numbered marker on a hairline, a large headline, and an optional intro / action beside it. */
export default function SectionHeader({
  index,
  label,
  title,
  intro,
  action,
}: {
  index: string;
  label: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Reveal>
      <p className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
        <span className="tabular-nums text-zinc-300">{index}</span>
        <span aria-hidden className="h-px w-10 bg-zinc-700" />
        {label}
      </p>
      <div className={`mt-7 grid gap-6 ${intro || action ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16" : ""}`}>
        <h2 className="font-display text-[clamp(38px,4.6vw,68px)] font-semibold leading-[1.02] tracking-[-0.045em] text-white">{title}</h2>
        {(intro || action) && (
          <div className="flex flex-col items-start gap-6 lg:pb-2">
            {intro && <p className="max-w-[440px] text-base leading-relaxed text-zinc-400 sm:text-lg">{intro}</p>}
            {action}
          </div>
        )}
      </div>
    </Reveal>
  );
}

/** The one serif word in a headline: "From idea to *impact*". */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="pr-[0.04em] font-serif text-[1.1em] font-normal italic tracking-[-0.02em] text-silver">{children}</em>;
}
