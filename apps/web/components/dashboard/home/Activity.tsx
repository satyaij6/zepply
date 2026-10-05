import { timeAgo } from "@/lib/utils";
import type { HomeData } from "@/types/dashboard";
import { Empty, ViewAll } from "./Automations";
import { Card, CardHeader, KIND } from "./ui";

const TINTS = ["bg-[#FBE7D3] text-[#9A4B12]", "bg-[#E3EAFE] text-[#2F4FC0]", "bg-[#DFF3E8] text-[#0E7A52]", "bg-[#F6E1EC] text-[#A1336A]", "bg-[#ECE5FB] text-[#5B3FC0]"];

/** The newest leads and which automation captured them. */
export function Activity({ data }: { data: HomeData }) {
  const leads = data.recentLeads;

  return (
    <Card className="flex flex-col p-6">
      <CardHeader title="Recent leads">{leads.length > 0 && <ViewAll href="/dashboard/leads" label="All leads" />}</CardHeader>

      {leads.length === 0 ? (
        <Empty title="No leads yet" body="When someone triggers one of your automations, they’ll show up here." />
      ) : (
        <ul className="mt-3 divide-y divide-app-line">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center gap-3.5 py-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase ${TINTS[lead.igUsername.charCodeAt(0) % TINTS.length]}`}>
                {lead.igUsername.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">@{lead.igUsername}</p>
                <p className="truncate text-xs text-app-muted">{source(lead.trigger)}</p>
              </div>
              <span className="shrink-0 text-xs text-app-faint">{timeAgo(lead.capturedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function source(trigger: HomeData["recentLeads"][number]["trigger"]) {
  if (!trigger) return "From an automation that’s since been removed";
  const keyword = trigger.keywords[0];
  return `${KIND[trigger.type].label}${keyword ? ` · “${keyword}”` : ""}`;
}
