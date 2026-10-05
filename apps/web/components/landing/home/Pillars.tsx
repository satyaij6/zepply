import { Reveal } from "./anim";

/* The tagline as an editorial band under the hero: three big words, each with its one-liner. */

const WORDS = [
  { word: "Create", body: "AI posts, clips, carousels and a 2‑week calendar." },
  { word: "Reply", body: "Automate Instagram DMs and manage comments." },
  { word: "Multiply", body: "Grow followers, leads and sales with less effort.", accent: true },
];

const PLATFORMS = ["Instagram", "YouTube", "TikTok", "Facebook", "WhatsApp"];

export default function Pillars() {
  return (
    <section id="features" className="relative scroll-mt-28 px-4 sm:px-8 lg:px-14 xl:-mt-12">
      <div className="mx-auto max-w-[1424px] border-t border-white/10">
        <ul className="grid md:grid-cols-3">
          {WORDS.map(({ word, body, accent }, i) => (
            <li key={word} className="border-white/10 py-10 not-first:border-t md:py-14 md:pr-10 md:not-first:border-l md:not-first:border-t-0 md:not-first:pl-10">
              <Reveal delay={i * 0.08}>
                <p className="font-display text-[clamp(48px,5.4vw,84px)] font-semibold leading-none tracking-[-0.04em] text-white">
                  {accent ? <em className="pr-[0.04em] font-serif text-[1.08em] font-normal italic tracking-[-0.02em] text-silver">{word}.</em> : `${word}.`}
                </p>
                <p className="mt-5 max-w-[320px] text-base leading-relaxed text-zinc-400 sm:text-lg">{body}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={0.2}>
          <p className="flex flex-col gap-3 border-t border-white/10 py-7 text-sm sm:flex-row sm:items-baseline sm:justify-between">
            <span className="font-medium text-white">All in one place.</span>
            <span className="text-zinc-500">
              {PLATFORMS.map((p, i) => (
                <span key={p}>
                  {i > 0 && <span className="px-2.5 text-zinc-700">/</span>}
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
