import Image from "next/image";
import { ArrowRight, Check, Play } from "lucide-react";
import BrandIcon, { BRAND_LABELS, type Brand } from "./BrandIcon";
import HeroStage from "./HeroStage";

const PLATFORMS: Brand[] = ["instagram", "youtube", "tiktok", "facebook", "whatsapp", "x"];
const ASSURANCES = ["No credit card required", "Setup in 5 minutes", "Works on web & mobile"];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background: near-black page with slowly drifting glows (navy behind the product, blue from the top, violet behind the copy) */}
      <div aria-hidden className="absolute inset-0 bg-night" />
      <div
        aria-hidden
        className="absolute left-[45%] top-[10%] h-[80%] w-[60%] animate-[glow-drift-a_26s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(37,64,170,0.45), rgba(37,64,170,0))" }}
      />
      <div
        aria-hidden
        className="absolute -top-[20%] left-[25%] h-[55%] w-[50%] animate-[glow-drift-b_22s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(61,126,255,0.2), rgba(61,126,255,0))" }}
      />
      <div
        aria-hidden
        className="absolute -left-[10%] top-[45%] h-[60%] w-[45%] animate-[glow-drift-c_30s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(80,70,210,0.16), rgba(80,70,210,0))" }}
      />
      {/* Light beam falling from the top edge */}
      <div aria-hidden className="absolute left-1/2 top-0 h-36 w-14 origin-top -translate-x-1/2 animate-[beam-pulse_4s_ease-in-out_infinite_alternate] bg-linear-to-b from-electric/60 to-transparent blur-xl motion-reduce:animate-none" />

      <div className="relative mx-auto grid max-w-[1536px] items-center gap-12 px-4 pb-32 pt-32 sm:px-8 lg:px-16 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-4 xl:pb-[150px] xl:pl-20 xl:pr-6 xl:pt-[136px]">
        <div className="max-w-[640px]">
          <span className="inline-block rounded-full bg-electric/10 px-4 py-1.5 text-sm font-medium text-silver ring-1 ring-inset ring-electric/30">
            Create. Reply. Multiply.
          </span>

          {/* Two-tone headline; the logo tile stands in for the word "Zepply" (its alt text) */}
          <h1 className="mt-6 font-display text-[clamp(40px,4.3vw,70px)] font-bold leading-[1.1] tracking-[-0.028em] text-white">
            Marketing, simply.
            <br />
            <span className="text-silver">With</span>{" "}
            <Image
              src="/landing/zepply-app-icon.png"
              alt="Zepply"
              width={384}
              height={384}
              preload
              className="inline-block h-[1.05em] w-[1.05em] -rotate-6 align-[-0.16em] drop-shadow-[0_0.12em_0.3em_rgba(61,126,255,0.45)]"
            />
          </h1>

          <p className="mt-6 max-w-[580px] text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Zepply handles your marketing by creating, posting and replying for you, so you can focus on your customers.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#waitlist"
              className="inline-flex h-[58px] items-center gap-3 rounded-xl bg-electric px-9 text-lg font-medium text-white shadow-[0_0_32px_-6px_rgba(61,126,255,0.7)] ring-1 ring-inset ring-white/20 transition hover:bg-electric-bright"
            >
              Start free now <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#features"
              className="inline-flex h-[58px] items-center gap-3 rounded-xl border border-night-line bg-white/[0.03] px-7 text-lg font-medium text-zinc-100 transition hover:border-zinc-600"
            >
              <Play className="h-4 w-4 fill-current" />
              Watch demo <span className="text-sm font-normal text-zinc-500">2 min</span>
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-electric" strokeWidth={2.4} /> {a}
              </li>
            ))}
          </ul>

          <p className="mt-14 text-xs font-medium tracking-[0.14em] text-zinc-500">WORKS WITH</p>
          <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4 text-zinc-400">
            {PLATFORMS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <BrandIcon brand={p} size={22} mono />
                <span className={p === "x" ? "sr-only" : undefined}>{BRAND_LABELS[p]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[860px] xl:max-w-none">
          <HeroStage />
        </div>
      </div>
    </section>
  );
}
