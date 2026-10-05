import { LayoutGrid, MessageCircleMore, TrendingUp, WandSparkles } from "lucide-react";

const PILLARS = [
  {
    title: "Create",
    body: "AI posts, clips, carousels and a 2-week calendar.",
    icon: WandSparkles,
    tile: "bg-[#7C4DF5]/15",
    fg: "text-[#A98BFF]",
  },
  {
    title: "Reply",
    body: "Automate Instagram DMs and manage comments.",
    icon: MessageCircleMore,
    tile: "bg-[#10A36B]/15",
    fg: "text-[#34D399]",
  },
  {
    title: "Multiply",
    body: "Grow followers, leads and sales with less effort.",
    icon: TrendingUp,
    tile: "bg-[#E8457F]/15",
    fg: "text-[#F472B6]",
  },
  {
    title: "All in one place",
    body: "Connect Instagram, YouTube, TikTok, Facebook and WhatsApp.",
    icon: LayoutGrid,
    tile: "bg-electric/15",
    fg: "text-[#7FA8FF]",
  },
];

export default function Pillars() {
  return (
    <section id="features" className="relative z-10 -mt-20 scroll-mt-28 px-4 sm:px-8 lg:px-14 xl:-mt-[96px]">
      <div className="mx-auto grid max-w-[1424px] gap-y-8 rounded-[28px] border border-night-line bg-night-raised/85 px-6 py-8 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur sm:grid-cols-2 sm:px-10 xl:grid-cols-4 xl:px-0 xl:py-7">
        {PILLARS.map(({ title, body, icon: Icon, tile, fg }) => (
          <div key={title} className="flex items-start gap-5 xl:border-l xl:border-night-line xl:px-6 xl:first:border-l-0 2xl:px-9">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/5 ${tile}`}>
              <Icon className={`h-7 w-7 ${fg}`} strokeWidth={2} />
            </span>
            <div>
              <h3 className="font-display text-[21px] font-bold tracking-[-0.02em] text-white">{title}</h3>
              <p className="mt-1.5 max-w-[250px] text-[15px] leading-snug text-zinc-400">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
