import { CalendarDays, Inbox, Palette, PenLine } from "lucide-react";
import BrandIcon, { BRAND_LABELS, type Brand } from "@/components/landing/home/BrandIcon";
import type { HomeData } from "@/types/dashboard";
import { Card, CardHeader } from "./ui";

const SOON_PLATFORMS: Brand[] = ["youtube", "tiktok", "facebook", "whatsapp"];

/** Instagram (real) plus the platforms that are on the way. */
export function Accounts({ data }: { data: HomeData }) {
  const ig = data.igAccount;
  return (
    <Card className="p-6">
      <CardHeader title="Connected accounts" />
      <ul className="mt-4 space-y-1">
        <li className="flex items-center gap-3 rounded-2xl bg-app-bg px-3 py-3">
          <BrandIcon brand="instagram" size={26} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{ig ? `@${ig.igUsername}` : "Instagram"}</p>
            <p className="text-xs text-app-muted">Instagram</p>
          </div>
          {ig ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#0E8A5F]">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Connected
            </span>
          ) : (
            <a href="/api/instagram/connect" className="rounded-lg bg-app-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black">
              Connect
            </a>
          )}
        </li>
        {SOON_PLATFORMS.map((p) => (
          <li key={p} className="flex items-center gap-3 px-3 py-2.5">
            <BrandIcon brand={p} size={22} className="opacity-50 grayscale" />
            <p className="flex-1 text-sm text-app-muted">{BRAND_LABELS[p]}</p>
            <span className="rounded-full border border-app-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-app-faint">Soon</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const NEXT = [
  { icon: PenLine, title: "Create", body: "AI posts, reels and carousels in your voice" },
  { icon: CalendarDays, title: "Calendar", body: "Plan and schedule two weeks at once" },
  { icon: Inbox, title: "Inbox", body: "Every DM and comment in one place" },
  { icon: Palette, title: "Brand Kit", body: "Your colours, fonts and tone, used everywhere" },
];

/** What's being built next — shown as a roadmap, not as working features. */
export function ComingNext() {
  return (
    <Card className="p-6">
      <CardHeader title="Coming to Zepply" />
      <ul className="mt-4 space-y-4">
        {NEXT.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-app-faint" strokeWidth={1.8} />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-app-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
