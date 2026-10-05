import Image from "next/image";
import {
  BarChart3, Bell, CalendarDays, ChevronDown, Coins, Heart, House, Lightbulb, MessageCircle,
  MessageSquare, MoreVertical, Palette, PenLine, Play, Plus, Search, Sun, Users, ArrowUp,
} from "lucide-react";
import BrandIcon, { type Brand } from "./BrandIcon";

/*
 * The hero's product picture: a dashboard with floating cards and handwritten
 * notes around it. The stage keeps a fixed aspect ratio and its font-size is
 * tied to its own width (container query units); everything inside is sized
 * in `em` and positioned in `%`, so the whole composition scales as one.
 */

const NAV = [
  { label: "Home", icon: House, active: true },
  { label: "Create", icon: PenLine },
  { label: "Calendar", icon: CalendarDays },
  { label: "Inspiration", icon: Lightbulb },
  { label: "Comments", icon: MessageSquare },
  { label: "DMs", icon: MessageCircle, badge: 12 },
  { label: "Analytics", icon: BarChart3 },
  { label: "Brand Kit", icon: Palette },
  { label: "Credits", icon: Coins },
];

const STATS = [
  { label: "Followers", value: "24.8K", change: "12%", icon: Users, tile: "bg-[#D6E2FF] text-[#2F6BF0]" },
  { label: "Views", value: "312K", change: "28%", icon: Play, tile: "bg-[#FBDDEA] text-[#E0337A] [&_svg]:fill-current" },
  { label: "Engagement", value: "18.4K", change: "32%", icon: Heart, tile: "bg-[#FBDDEA] text-[#E0337A] [&_svg]:fill-current" },
  { label: "Leads", value: "320", change: "45%", icon: BarChart3, tile: "bg-[#D6E2FF] text-[#2F6BF0]" },
];

const UPCOMING: { brand: Brand; src: string; title: string; when: string }[] = [
  { brand: "instagram", src: "/landing/latte.jpg", title: "Morning coffee, better ideas. ☕", when: "Oct 4, 9:00 AM" },
  { brand: "tiktok", src: "/landing/brew.jpg", title: "Behind the brew #shorts", when: "Oct 5, 12:00 PM" },
  { brand: "instagram", src: "/landing/space.jpg", title: "Our new space ✨", when: "Oct 6, 9:00 AM" },
  { brand: "youtube", src: "/landing/latte-pour.jpg", title: "Latte art tutorial #shorts", when: "Oct 7, 11:00 AM" },
];

const FLOATING: { brand: Brand; src: string; className: string; caption?: string }[] = [
  { brand: "instagram", src: "/landing/phone-cafe.jpg", className: "left-[45%] top-[3.5%] w-[16%] -rotate-[7deg]", caption: "Good food, better people" },
  { brand: "tiktok", src: "/landing/brew.jpg", className: "left-[60%] top-0 w-[18%] rotate-[3deg]" },
  { brand: "youtube", src: "/landing/latte-pour.jpg", className: "left-[77.5%] top-[3%] w-[17.5%] rotate-[9deg]" },
];

const GROWTH_BARS = [18, 26, 20, 34, 28, 40, 32, 48, 42, 56, 50, 64, 58, 72, 66, 84, 76, 96];

function Dashboard() {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-[1.4em] border border-[#F4F5FA] bg-[#E9EBF3] shadow-[0_2em_5em_-1.5em_rgba(0,0,0,0.8),0_0_6em_-1em_rgba(61,126,255,0.35)]">
      {/* Sidebar */}
      <aside className="flex w-[9.9em] shrink-0 flex-col border-r border-[#D3D7E3] bg-[#DFE2EC] px-[0.8em] pb-[1em] pt-[1.5em]">
        <div className="mb-[1.6em] flex items-center gap-[0.5em] px-[0.4em]">
          <Image src="/icons/sidebar/zepply-logo.png" alt="" width={14} height={20} className="h-[1.45em] w-auto" />
          <span className="text-[1.15em] font-extrabold tracking-tight text-[#0F1020]">Zepply</span>
        </div>
        <nav className="flex flex-col gap-[0.25em]">
          {NAV.map(({ label, icon: Icon, active, badge }) => (
            <div
              key={label}
              className={`flex items-center gap-[0.7em] rounded-[0.6em] px-[0.7em] py-[0.55em] text-[0.74em] ${
                active ? "bg-[#D6E2FF] font-semibold text-[#2F6BF0]" : "text-[#4A4E5E]"
              }`}
            >
              <Icon className="h-[1.15em] w-[1.15em]" strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
              {badge && <span className="rounded-full bg-[#F43F75] px-[0.5em] text-[0.82em] font-semibold text-white">{badge}</span>}
            </div>
          ))}
        </nav>
        <div className="mt-[3.4em] flex items-center gap-[0.5em] rounded-[0.7em] px-[0.3em]">
          <Image src="/landing/latte.jpg" alt="" width={40} height={40} className="h-[1.9em] w-[1.9em] rounded-full object-cover" />
          <div className="leading-tight">
            <p className="text-[0.62em] font-semibold text-[#15161F]">The Brew House</p>
            <p className="text-[0.52em] text-[#6B7080]">Business plan</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col px-[1.5em] pt-[1.2em]">
        <div className="flex items-center justify-between">
          <div className="flex w-[21em] items-center gap-[0.6em] rounded-[0.6em] bg-white/60 px-[0.8em] py-[0.55em] text-[0.68em] text-[#8A8FA0] ring-1 ring-[#D3D7E3]">
            <Search className="h-[1.2em] w-[1.2em]" /> Search anything…
          </div>
          <div className="flex items-center gap-[1.4em] text-[#4A4E5E]">
            <Sun className="h-[1.1em] w-[1.1em]" />
            <span className="relative">
              <Bell className="h-[1.1em] w-[1.1em]" />
              <span className="absolute -right-[0.1em] -top-[0.1em] h-[0.42em] w-[0.42em] rounded-full bg-[#F43F75]" />
            </span>
            <Image src="/landing/avatar-owner.jpg" alt="" width={40} height={40} className="h-[2em] w-[2em] rounded-full object-cover" />
          </div>
        </div>

        <div className="mt-[1.7em] flex items-start justify-between">
          <div>
            <p className="text-[1.3em] font-semibold tracking-tight text-[#0F1020]">Good morning, Satya 👋</p>
            <p className="mt-[0.15em] text-[0.74em] text-[#5C6070]">Here&apos;s what&apos;s happening with your content.</p>
          </div>
          <div className="flex items-center gap-[0.7em] rounded-[0.6em] border border-[#D3D7E3] px-[0.8em] py-[0.5em] text-[0.68em] text-[#3A3E4E]">
            <CalendarDays className="h-[1.1em] w-[1.1em]" /> Oct 1 – Oct 7 <ChevronDown className="ml-[0.6em] h-[1.1em] w-[1.1em]" />
          </div>
        </div>

        <div className="mt-[1.3em] grid grid-cols-4 gap-[0.8em]">
          {STATS.map(({ label, value, change, icon: Icon, tile }) => (
            <div key={label} className="rounded-[0.8em] border border-[#D9DCE6] bg-[#F5F6FA] p-[0.9em] shadow-[0_0.4em_1em_-0.6em_rgba(30,35,60,0.25)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[0.64em] text-[#6B7080]">{label}</p>
                  <p className="mt-[0.3em] text-[1.15em] font-semibold tracking-tight text-[#0F1020]">{value}</p>
                </div>
                <span className={`flex h-[2.1em] w-[2.1em] items-center justify-center rounded-[0.6em] ${tile}`}>
                  <Icon className="h-[1.05em] w-[1.05em]" strokeWidth={2.2} />
                </span>
              </div>
              <p className="mt-[0.5em] flex items-center gap-[0.2em] text-[0.62em] font-medium text-[#0E9F6E]">
                <ArrowUp className="h-[1.1em] w-[1.1em]" /> {change}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-[1.7em] flex items-center justify-between">
          <p className="text-[0.9em] font-semibold text-[#0F1020]">Upcoming content</p>
          <span className="text-[0.64em] font-medium text-[#2F6BF0]">View calendar →</span>
        </div>

        <div className="mt-[0.9em] grid grid-cols-5 gap-[0.8em]">
          {UPCOMING.map(({ brand, src, title, when }) => (
            <div key={title} className="overflow-hidden rounded-[0.8em] border border-[#D9DCE6] bg-[#F5F6FA] shadow-[0_0.4em_1em_-0.6em_rgba(30,35,60,0.25)]">
              <div className="relative aspect-[1/0.95]">
                <Image src={src} alt="" fill sizes="140px" className="object-cover" />
                <BrandIcon brand={brand} className="absolute left-[0.45em] top-[0.45em] h-[1.4em] w-[1.4em] drop-shadow" />
              </div>
              <div className="px-[0.6em] pb-[0.6em] pt-[0.5em]">
                <p className="line-clamp-2 min-h-[2.6em] text-[0.6em] font-medium leading-snug text-[#15161F]">{title}</p>
                <div className="mt-[0.6em] flex items-center justify-between text-[0.54em] text-[#6B7080]">
                  {when} <MoreVertical className="h-[1.2em] w-[1.2em]" />
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-col items-center justify-center gap-[0.7em] rounded-[0.8em] border border-dashed border-[#B9CCF5] bg-[#E1E8F7] px-[0.4em] text-center">
            <span className="flex h-[2.1em] w-[2.1em] items-center justify-center rounded-full bg-[#D6E2FF] text-[#2F6BF0]">
              <Plus className="h-[1.2em] w-[1.2em]" strokeWidth={2.4} />
            </span>
            <span className="text-[0.62em] font-medium leading-snug text-[#2F6BF0]">
              Generate
              <br />
              more content
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingPost({ brand, src, className, caption }: (typeof FLOATING)[number]) {
  return (
    <div className={`absolute rounded-[1em] bg-[#E9EBF3] p-[0.35em] shadow-[0_1em_2.5em_-1em_rgba(0,0,0,0.7)] ${className}`}>
      <div className="relative aspect-[4/3.6] overflow-hidden rounded-[0.75em]">
        <Image src={src} alt="" fill sizes="160px" className="object-cover" />
        <div className="absolute inset-0 bg-black/10" />
        <BrandIcon brand={brand} className="absolute left-[0.5em] top-[0.5em] h-[1.7em] w-[1.7em] drop-shadow" />
        {caption && (
          <p className="absolute bottom-[0.6em] left-[0.6em] w-[60%] text-[0.62em] font-black uppercase leading-[0.95] text-white/90">{caption}</p>
        )}
        <Play className="absolute left-1/2 top-[58%] h-[1.4em] w-[1.4em] -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />
      </div>
    </div>
  );
}

function DmCard() {
  return (
    <div className="absolute left-0 top-[76.5%] w-[36%] rounded-[1.1em] bg-[#E9EBF3] p-[0.9em] shadow-[0_1.4em_3em_-1em_rgba(0,0,0,0.8)] ring-1 ring-white/40">
      <div className="flex items-start gap-[0.6em]">
        <BrandIcon brand="instagram" className="h-[1.4em] w-[1.4em] shrink-0" />
        <Image src="/landing/avatar-customer.jpg" alt="" width={48} height={48} className="h-[2.6em] w-[2.6em] shrink-0 rounded-full object-cover" />
        <p className="pt-[0.6em] text-[0.8em] font-medium text-[#15161F]">Hey! Do you have this in lower price?</p>
      </div>
      <div className="ml-[6.4em] mt-[0.4em] inline-flex items-center gap-[0.8em] rounded-full border border-[#C3D4FA] bg-[#DCE6FA] px-[1em] py-[0.45em] text-[0.78em] text-[#2A2E3E]">
        AI replying…
        <span className="flex gap-[0.25em]">
          {[0, 150, 300].map((delay) => (
            <span key={delay} className="h-[0.45em] w-[0.45em] animate-bounce rounded-full bg-[#3D7EFF]" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

function GrowthCard() {
  return (
    <div className="absolute left-[47%] top-[80.5%] w-[34%] rounded-[1.1em] bg-[#E9EBF3] px-[1.1em] pb-[1em] pt-[0.9em] shadow-[0_1.4em_3em_-1em_rgba(0,0,0,0.8)] ring-1 ring-white/40">
      <div className="flex items-center justify-between">
        <p className="text-[0.8em] font-semibold text-[#0F1020]">Account growth</p>
        <span className="flex items-center gap-[0.2em] rounded-full bg-[#CFEFE0] px-[0.6em] py-[0.15em] text-[0.68em] font-semibold text-[#0E8A5F]">
          <ArrowUp className="h-[1em] w-[1em]" /> 28%
        </span>
      </div>
      <div className="relative mt-[1.1em] flex h-[4.6em] items-end gap-[0.32em]">
        {GROWTH_BARS.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-full"
            style={{ height: `${h}%`, background: `linear-gradient(180deg, ${i > 13 ? "#3D7EFF" : "#BFCDEB"}, ${i > 13 ? "#7FA8FF" : "#D5DEF0"})` }}
          />
        ))}
        <div className="absolute right-[1.6em] top-[0.2em] rounded-[0.6em] bg-[#0F1020] px-[0.8em] py-[0.45em] text-white shadow-lg">
          <p className="text-[0.85em] font-semibold leading-none">24.8K</p>
          <p className="mt-[0.25em] text-[0.55em] leading-none text-white/60">followers</p>
        </div>
      </div>
    </div>
  );
}

/** Handwritten note with a hand-drawn arrow; `arrow` is a path in a 60×40 box. */
function Note({ children, className, arrow, arrowClassName }: { children: React.ReactNode; className: string; arrow: string; arrowClassName: string }) {
  return (
    <div className={`absolute hidden whitespace-nowrap font-hand text-[1.25em] leading-[1.05] text-silver sm:block ${className}`}>
      <p>{children}</p>
      <svg viewBox="0 0 60 40" className={`absolute h-[2.6em] w-[3.9em] ${arrowClassName}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <path d={arrow} />
      </svg>
    </div>
  );
}

export default function HeroStage() {
  return (
    <div
      role="img"
      aria-label="Zepply dashboard with scheduled posts, an AI reply to a DM and an account-growth chart"
      className="relative w-full [container-type:inline-size]"
    >
      <div className="relative aspect-[905/785] w-full" style={{ fontSize: "calc(100cqw / 60)" }}>
        {/* soft glow behind the product */}
        <div aria-hidden className="absolute left-[15%] top-[20%] h-[70%] w-[80%] rounded-full bg-electric opacity-25 blur-[5em]" />

        {FLOATING.map((post) => (
          <FloatingPost key={post.src} {...post} />
        ))}

        <div className="absolute left-[8.3%] top-[15.3%] h-[70.7%] w-[89%]">
          <Dashboard />
        </div>

        <DmCard />
        <GrowthCard />

        <Note className="left-[19%] top-[3%] -rotate-[8deg]" arrow="M6 6 C 14 30, 34 34, 54 24 M46 18 L54 24 L45 29" arrowClassName="left-[8.5em] top-[1.6em]">
          Posts, Reels,
          <br />
          Carousels — on autopilot
        </Note>
        <Note className="left-[21.5%] top-[92%] -rotate-[4deg]" arrow="M30 36 C 24 22, 12 16, 8 4 M3 11 L8 4 L14 10" arrowClassName="-left-[3.4em] -top-[2.2em]">
          AI replies to DMs
          <br />
          in your brand voice
        </Note>
        <Note className="left-[83%] top-[89%] -rotate-[18deg]" arrow="M18 38 C 10 26, 12 14, 22 4 M15 8 L22 4 L24 12" arrowClassName="-left-[0.4em] -top-[2.8em]">
          Track your growth
          <br />
          and real results
        </Note>
      </div>
    </div>
  );
}
