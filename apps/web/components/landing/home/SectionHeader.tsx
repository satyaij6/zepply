import type { ReactNode } from "react";
import { Reveal } from "./anim";

const TITLE = "font-display text-[clamp(38px,4.6vw,68px)] font-semibold leading-[1.04] tracking-[-0.03em] text-balance text-white";
const INTRO = "text-base leading-relaxed text-zinc-400 sm:text-lg";

/**
 * Section opener: a numbered marker on a hairline, a large headline, and an optional intro / action.
 * Sections use different `align`s so they don't all open the same way:
 * - split:  headline left, intro and action on the right
 * - stack:  headline, then intro underneath, all left-aligned
 * - center: everything centred
 */
export default function SectionHeader({
  index,
  label,
  title,
  intro,
  action,
  align = "split",
}: {
  index: string;
  label: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  align?: "split" | "stack" | "center";
}) {
  const marker = (
    <p className={`flex items-center gap-4 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 ${align === "center" ? "justify-center" : ""}`}>
      <span className="tabular-nums text-zinc-300">{index}</span>
      <span aria-hidden className="h-px w-10 bg-zinc-700" />
      {label}
    </p>
  );

  if (align === "center") {
    return (
      <Reveal className="text-center">
        {marker}
        <h2 className={`mx-auto mt-7 max-w-[980px] ${TITLE}`}>{title}</h2>
        {intro && <p className={`mx-auto mt-6 max-w-[560px] ${INTRO}`}>{intro}</p>}
        {action && <div className="mt-9 flex justify-center">{action}</div>}
      </Reveal>
    );
  }

  if (align === "stack") {
    return (
      <Reveal>
        {marker}
        <h2 className={`mt-7 max-w-[920px] ${TITLE}`}>{title}</h2>
        {intro && <p className={`mt-6 max-w-[520px] ${INTRO}`}>{intro}</p>}
        {action && <div className="mt-9">{action}</div>}
      </Reveal>
    );
  }

  return (
    <Reveal>
      {marker}
      <div className={`mt-7 grid gap-6 ${intro || action ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16" : ""}`}>
        <h2 className={TITLE}>{title}</h2>
        {(intro || action) && (
          <div className="flex flex-col items-start gap-6 lg:pb-2">
            {intro && <p className={`max-w-[440px] ${INTRO}`}>{intro}</p>}
            {action}
          </div>
        )}
      </div>
    </Reveal>
  );
}

/** The one serif word in a headline: "From idea to *impact*". */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="pr-[0.04em] font-serif text-[1.1em] font-normal italic tracking-[-0.01em] text-silver">{children}</em>;
}
