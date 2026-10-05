import { DrawLine, Reveal, Rise } from "./anim";

/* The tagline as an editorial band under the hero: three big words rise into place, each with its one-liner. */

const WORDS = [
  { word: "Create", body: "AI posts, clips, carousels and a 2‑week calendar." },
  { word: "Reply", body: "Automate Instagram DMs and manage comments." },
  { word: "Multiply", body: "Grow followers, leads and sales with less effort.", accent: true },
];

const PLATFORMS = ["Instagram", "YouTube", "TikTok", "Facebook", "WhatsApp"];

export default function Pillars() {
  return (
    <section id="features" className="relative scroll-mt-28 px-4 sm:px-8 lg:px-14 xl:-mt-12">
      <div className="mx-auto max-w-[1424px]">
        <DrawLine />
        <ul className="grid md:grid-cols-3">
          {WORDS.map(({ word, body, accent }, i) => (
            <li key={word} className="relative py-10 md:py-16 md:pr-10 md:not-first:pl-10">
              {i > 0 && (
                <>
                  <DrawLine className="absolute inset-x-0 top-0 md:hidden" delay={i * 0.1} />
                  <span aria-hidden className="absolute inset-y-0 left-0 hidden w-px bg-white/10 md:block" />
                </>
              )}
              <p className="font-display text-[clamp(48px,5.4vw,84px)] font-semibold leading-none tracking-[-0.03em] text-white">
                <Rise delay={i * 0.12}>
                  {accent ? <em className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-silver">{word}.</em> : `${word}.`}
                </Rise>
              </p>
              <Reveal delay={0.35 + i * 0.12} y={12}>
                <p className="mt-5 max-w-[320px] text-base leading-relaxed text-zinc-400 sm:text-lg">{body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
        <DrawLine delay={0.3} />

        <Reveal delay={0.5} y={8}>
          <p className="flex flex-col gap-3 py-7 text-base sm:flex-row sm:items-baseline sm:justify-between">
            <span className="font-medium text-white">All in one place.</span>
            <span className="flex flex-wrap gap-y-1 text-zinc-400">
              {PLATFORMS.map((p, i) => (
                <span key={p}>
                  {i > 0 && <span className="px-3 text-zinc-700">/</span>}
                  {p}
                </span>
              ))}
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
