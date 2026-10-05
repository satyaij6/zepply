import { Accent } from "./SectionHeader";
import { Reveal } from "./anim";
import WaitlistForm from "./WaitlistForm";

/** Closing call to action: the hero's drifting glow returns behind a big centred headline and the waitlist form. */
export default function FinalCta() {
  return (
    <section id="waitlist" className="relative scroll-mt-20 overflow-hidden px-4 py-40 sm:px-8 lg:py-52">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <div
        aria-hidden
        className="absolute left-[10%] top-[15%] h-[80%] w-[55%] animate-[glow-drift-a_26s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(37,64,170,0.4), rgba(37,64,170,0))" }}
      />
      <div
        aria-hidden
        className="absolute right-[5%] top-[25%] h-[70%] w-[50%] animate-[glow-drift-c_30s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(80,70,210,0.22), rgba(80,70,210,0))" }}
      />
      <div aria-hidden className="absolute left-1/2 top-0 h-40 w-14 origin-top -translate-x-1/2 animate-[beam-pulse_4s_ease-in-out_infinite_alternate] bg-linear-to-b from-electric/60 to-transparent blur-xl motion-reduce:animate-none" />

      <Reveal className="relative mx-auto max-w-[880px] text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">Be part of what&apos;s next</p>
        <h2 className="mt-7 font-display text-[clamp(44px,7vw,104px)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
          Join the <Accent>waitlist</Accent>.
        </h2>
        <p className="mx-auto mt-6 max-w-[480px] text-base leading-relaxed text-zinc-400 sm:text-lg">Get early access, exclusive updates and special pricing.</p>
        <WaitlistForm />
      </Reveal>
    </section>
  );
}
