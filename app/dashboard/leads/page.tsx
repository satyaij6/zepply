"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TriggerTypeBadge } from "@/components/triggers/TriggerTypeSelector";
import { formatDateTime } from "@/lib/utils";
import { Users, Download, Search, ExternalLink, X } from "lucide-react";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  useEffect(() => {
    fetchLeads();
  }, [search, page]);

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.open("/api/leads/export", "_blank");
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${total} leads captured so far.`}
        action={
          <button
            onClick={handleExport}
            disabled={total === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by @username..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-purple-500" />}
          title="No leads yet"
          description="When someone interacts with your triggers, they'll appear here."
        />
      ) : (
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Source Trigger</th>
                  <th className="px-4 py-3 font-medium">Captured At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-400">{(page - 1) * 50 + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      @{lead.igUsername}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {lead.trigger ? (
                        <TriggerTypeBadge type={lead.trigger.type} />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDateTime(lead.capturedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead detail slide-over */}
      {selectedLead && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setSelectedLead(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-950 z-50 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Details</h2>
              <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Username</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">@{selectedLead.igUsername}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Source Trigger</p>
                {selectedLead.trigger ? (
                  <div className="flex items-center gap-2">
                    <TriggerTypeBadge type={selectedLead.trigger.type} />
                    {selectedLead.trigger.keywords?.length > 0 && (
                      <span className="text-sm text-gray-500">
                        ({selectedLead.trigger.keywords.join(", ")})
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Unknown</p>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Captured</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDateTime(selectedLead.capturedAt)}
                </p>
              </div>

              <a
                href={`https://instagram.com/${selectedLead.igUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-lg hover:opacity-90 transition-opacity mt-4"
              >
                <ExternalLink className="w-4 h-4" /> Open on Instagram
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
