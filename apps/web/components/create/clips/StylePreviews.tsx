"use client";

/*
 * Previews for the style pickers, drawn in the browser so they work before any footage exists.
 * Once preview videos are rendered from a real clip (workers/clipper/scripts/render_previews.py),
 * TEMPLATE_VIDEOS maps a template to its file and TemplatePreview plays that instead.
 */
import type { CSSProperties, ReactNode } from "react";
import { TEMPLATE_VIDEOS } from "./template-videos";

/** A dark tile showing the sample phrase in one caption style, like a frame of the real thing. */
export function CaptionSample({ style, accent }: { style: string; accent: string }) {
  const shadow = "0 0 2px rgba(0,0,0,.6), 0 3px 12px rgba(0,0,0,.5)";
  const base: CSSProperties = { color: "#fff", textShadow: shadow, lineHeight: 1.05 };
  switch (style) {
    case "none":
      return <span className="text-[13px] font-medium text-zinc-500">No captions</span>;
    case "kinetic":
      return (
        <span className="relative flex w-full items-center justify-between px-3" style={base}>
          <span className="text-[13px] font-medium">you need</span>
          <span className="relative text-[26px] font-semibold tracking-[-0.03em]">
            this
            <svg viewBox="0 0 60 10" className="absolute -bottom-1.5 left-0 h-2 w-full overflow-visible" aria-hidden>
              <path d="M1 7 C 18 3, 40 9, 59 5" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
        </span>
      );
    case "karaoke":
      return (
        <span className="flex gap-1 text-[19px] font-extrabold tracking-[-0.02em]" style={base}>
          <span>you</span>
          <span className="rounded-md bg-white px-1 text-[#111]" style={{ textShadow: "none" }}>need</span>
          <span>this</span>
        </span>
      );
    case "pill":
      return <span className="rounded-lg bg-[#222]/90 px-3 py-1.5 text-[15px] font-semibold text-white">you need this</span>;
    case "emphasis":
      return (
        <span className="flex flex-col items-center" style={base}>
          <span className="text-[12px] font-medium">you need</span>
          <span className="text-[28px] font-bold tracking-[-0.03em]" style={{ color: accent }}>this</span>
        </span>
      );
    case "caps":
      return (
        <span className="text-[18px] font-extrabold tracking-[0.01em]" style={base}>
          YOU NEED <span style={{ color: "#FFE11A" }}>THIS</span>
        </span>
      );
    case "tiktok":
      return <span className="text-[20px] font-black uppercase" style={{ ...base, WebkitTextStroke: "1px #000" }}>you need this</span>;
    case "roboto":
      return <span className="text-[17px] font-semibold" style={base}>you need this</span>;
    case "zalando":
      return <span className="text-[14px] font-bold uppercase tracking-[0.18em]" style={base}>you need this</span>;
    case "didot":
      return <span className="font-serif text-[21px] italic" style={base}>you need this</span>;
    case "headline":
      return (
        <span className="flex w-full flex-col items-center gap-1.5">
          <span className="text-[13px] font-black uppercase text-white">Fear <span className="text-[#E8141E]">vs</span> clarity</span>
          <span className="h-10 w-16 rounded-sm bg-gradient-to-br from-zinc-600 to-zinc-800" />
        </span>
      );
    case "telugu_noto":
      return <span className="text-[17px] font-semibold" style={base}>మీకు ఇది కావాలి</span>;
    case "roman":
      return <span className="text-[17px] font-bold" style={{ ...base, WebkitTextStroke: "0.6px #000" }}>meeku idi kavali</span>;
    default: // clean: Telugu script, outlined
      return <span className="text-[18px] font-bold" style={{ ...base, WebkitTextStroke: "0.6px #000" }}>మీకు ఇది కావాలి</span>;
  }
}

function Person({ className = "" }: { className?: string }) {
  // A quiet silhouette stands in for the speaker until previews are rendered from real footage.
  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden>
      <defs>
        <linearGradient id="zp-rim" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#4a4f5c" />
          <stop offset="0.55" stopColor="#262a33" />
          <stop offset="1" stopColor="#1a1d24" />
        </linearGradient>
      </defs>
      <path d="M6 120 C 8 90, 27 78, 50 78 C 73 78, 92 90, 94 120 Z" fill="url(#zp-rim)" />
      <rect x="41" y="60" width="18" height="22" rx="7" fill="url(#zp-rim)" />
      <ellipse cx="50" cy="42" rx="21" ry="25" fill="url(#zp-rim)" />
    </svg>
  );
}

function Room({ children, tone = "warm" }: { children: ReactNode; tone?: "warm" | "dark" }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          tone === "warm"
            ? "radial-gradient(120% 70% at 70% 20%, #6b4a33 0%, #3a281d 45%, #1d1511 100%)"
            : "radial-gradient(120% 70% at 50% 25%, #3a3f4a 0%, #1c1f26 60%, #0e1014 100%)",
      }}
    >
      {children}
    </div>
  );
}

/** A frame of each template, as a small animated mock-up; real video when one exists. */
export function TemplatePreview({ template, accent, canvas, big = false }: { template: string; accent: string; canvas: string; big?: boolean }) {
  const video = TEMPLATE_VIDEOS[template];
  if (video) {
    return <video src={video} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />;
  }
  const s = big ? 1.6 : 1; // type scale for the big example frame
  const text = (px: number) => ({ fontSize: px * s });
  const shadow = "0 0 2px rgba(0,0,0,.6), 0 3px 12px rgba(0,0,0,.5)";

  switch (template) {
    case "kinetic":
      return (
        <Room>
          <Person className="absolute bottom-0 left-1/2 w-[82%] -translate-x-1/2" />
          <span className="zp-pop absolute left-1/2 top-[11%] -translate-x-1/2 font-semibold tracking-[-0.03em] text-white" style={{ ...text(26), textShadow: shadow }}>
            <span className="relative">
              <span className="absolute -inset-x-1 inset-y-0.5 -z-10" style={{ background: accent }} />
              growth
            </span>
          </span>
          <span className="zp-pop-2 absolute left-[7%] top-[42%] font-medium text-white" style={{ ...text(12), textShadow: shadow }}>
            this is
          </span>
          <span className="zp-pop-3 absolute right-[7%] top-[42%] font-medium text-white" style={{ ...text(12), textShadow: shadow }}>
            how
          </span>
        </Room>
      );
    case "comment":
      return (
        <div className="absolute inset-0" style={{ background: canvas }}>
          <div className="absolute inset-x-[8%] top-[8%]">
            <p className="font-bold tracking-[0.18em]" style={{ ...text(6.5), color: accent }}>THE OFFER</p>
            <p className="mt-1 font-extrabold leading-[0.95] text-[#F3E7CF]" style={text(19)}>FREE FOR<br />12 MONTHS</p>
          </div>
          <p className="absolute inset-x-0 top-[44%] text-center font-extrabold text-white" style={text(11)}>
            just <span className="rounded bg-white px-0.5 text-[#111]">comment</span> below
          </p>
          <div className="absolute inset-x-[10%] bottom-[5%] top-[52%] overflow-hidden rounded-xl shadow-lg">
            <Room>
              <Person className="absolute bottom-0 left-1/2 w-[86%] -translate-x-1/2" />
            </Room>
          </div>
        </div>
      );
    case "editorial":
      return (
        <div className="absolute inset-0 bg-[#0B0B0F]">
          <svg viewBox="0 0 100 80" className="absolute inset-x-[12%] top-[20%] w-[76%]" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <g key={i} className="zp-lift" style={{ animationDelay: `${i * 0.12}s` }}>
                <path
                  d={`M50 ${58 - i * 11} L82 ${46 - i * 11} L50 ${34 - i * 11} L18 ${46 - i * 11} Z`}
                  fill="#0B0B0F"
                  stroke={i === 3 ? accent : "#9EA1AB"}
                  strokeWidth="1"
                />
              </g>
            ))}
          </svg>
          <p className="absolute inset-x-0 top-[66%] text-center font-semibold text-[#F4F1EA]" style={text(15)}>LAYERS</p>
          <p className="absolute inset-x-0 bottom-[8%] text-center font-medium text-white" style={text(8)}>
            built <span className="font-bold" style={{ color: accent }}>layer</span> by layer
          </p>
        </div>
      );
    case "explainer":
      return (
        <div className="absolute inset-0 bg-[#F0F6F6] px-[10%] pt-[14%]">
          <p className="text-[#181E1E]" style={text(12)}>
            <span style={{ color: accent }}>3x</span> faster.
          </p>
          <div className="mt-[14%] space-y-[9%]">
            {[
              [92, true],
              [48, false],
              [36, false],
            ].map(([w, win], i) => (
              <div key={i} className="h-[7px] rounded-full bg-[#E4F0E4]" style={{ opacity: win ? 1 : 0.5 }}>
                <div className="zp-grow h-full rounded-full" style={{ width: `${w}%`, background: win ? accent : "#C0CCC0", animationDelay: `${i * 0.1}s` }} />
              </div>
            ))}
          </div>
          <span className="absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#222]/90 px-2 py-1 font-semibold text-white" style={text(8)}>
            it&apos;s three times faster
          </span>
        </div>
      );
    case "signal":
      return (
        <div
          className="absolute inset-0 bg-[#181818]"
          style={{ backgroundImage: "linear-gradient(#242424 1px, transparent 1px), linear-gradient(90deg, #242424 1px, transparent 1px)", backgroundSize: "14% 8%" }}
        >
          <div className="zp-slide absolute left-[-20%] top-[36%] flex">
            {[
              ["#4A86DC", "Plan"],
              ["#F0DC0A", ""],
              ["#E68C5F", "Read"],
              ["#A082F0", ""],
              ["#2AAA6A", "Write"],
            ].map(([c, l], i) => (
              <span key={i} className="flex items-center justify-center font-mono text-[#181818]" style={{ background: c, height: 18 * s, minWidth: (l ? 34 : 14) * s, ...text(7) }}>
                {l}
              </span>
            ))}
            <span className="ml-0.5 rounded-full border-2 border-white" style={{ width: 16 * s, height: 16 * s }} />
          </div>
          <p className="absolute inset-x-0 bottom-[10%] text-center font-extrabold text-white" style={text(10)}>
            STEP ONE: <span className="text-[#FFE11A]">PLAN</span>
          </p>
        </div>
      );
    default: // simple
      return (
        <Room>
          <Person className="absolute bottom-0 left-1/2 w-[82%] -translate-x-1/2" />
          <p className="absolute inset-x-0 bottom-[16%] text-center font-bold text-white" style={{ ...text(11), textShadow: shadow, WebkitTextStroke: "0.4px #000" }}>
            this is how it works
          </p>
        </Room>
      );
  }
}
