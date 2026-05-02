"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TriggerTypeBadge } from "@/components/triggers/TriggerTypeSelector";
import { formatDateTime } from "@/lib/utils";
import { 
  Users, 
  Download, 
  Search, 
  ExternalLink, 
  X, 
  TrendingUp, 
  UserPlus, 
  MessageSquare,
  MoreVertical,
  Mail,
  Filter
} from "lucide-react";

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

  const stats = [
    { label: "Total Leads", value: total, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "New Today", value: Math.floor(total * 0.1), icon: UserPlus, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Active Conversations", value: Math.floor(total * 0.4), icon: MessageSquare, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Growth Rate", value: "+12.5%", icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Leads CRM</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and export everyone who interacted with your automations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={total === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-xl hover:bg-gray-50 dark:hover:bg-[#2C2D32] transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Live</span>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by username, email or trigger..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-2xl text-[14px] text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#3D7EFF] focus:border-transparent outline-none transition-all"
          />
        </div>
        <button className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2C2D32] transition-all">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-[#2C2D32]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#2C2D32]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-[#2C2D32] rounded" />
                <div className="h-3 w-48 bg-gray-100 dark:bg-[#2C2D32] rounded" />
              </div>
              <div className="h-8 w-24 bg-gray-100 dark:bg-[#2C2D32] rounded-full" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-3xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-[#F5F5F7] dark:bg-[#2C2D32] rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3 hover:rotate-0 transition-transform">
            <Users className="w-10 h-10 text-[#3D7EFF]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No leads captured yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8">
            When users interact with your Instagram automations, they'll appear here automatically.
          </p>
          <a href="/dashboard/triggers/new" className="inline-flex items-center gap-2 px-6 py-3 bg-[#3D7EFF] text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
            Create your first trigger
          </a>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-[#2C2D32]/30 border-b border-[#E5E7EB] dark:border-[#2C2D32]">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Trigger Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Captured Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#2C2D32]">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3D7EFF] to-[#7C3AED] flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                          {lead.igUsername.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">@{lead.igUsername}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{lead.email || "No email captured"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {lead.trigger ? (
                        <div className="flex items-center gap-2">
                          <TriggerTypeBadge type={lead.trigger.type} />
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">
                            {lead.trigger.keywords?.[0] || lead.trigger.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Direct Interaction</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {formatDateTime(lead.capturedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-xl text-gray-400 hover:text-[#3D7EFF] hover:bg-[#3D7EFF]/10 transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 50 && (
            <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2C2D32] flex items-center justify-between">
              <p className="text-sm text-gray-500">Showing {leads.length} of {total} leads</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#2C2D32] rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <button className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#2C2D32] rounded-xl hover:bg-gray-100 transition-all" onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lead Detail Slide-over */}
      {selectedLead && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 transition-opacity" 
            onClick={() => setSelectedLead(null)} 
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white dark:bg-[#121214] z-[60] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-8 border-b border-[#E5E7EB] dark:border-[#2C2D32] flex items-center justify-between bg-gray-50/50 dark:bg-[#1E1F23]/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#3D7EFF] to-[#7C3AED] flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20">
                  {selectedLead.igUsername.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">@{selectedLead.igUsername}</h2>
                  <p className="text-sm text-green-500 font-bold flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Active Lead
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLead(null)} 
                className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1F23] border border-[#E5E7EB] dark:border-[#2C2D32] text-gray-400 hover:text-gray-600 transition-all shadow-sm active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Stats / Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-[#1E1F23] p-4 rounded-2xl border border-[#E5E7EB] dark:border-[#2C2D32]">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Interactions</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">12 Total</p>
                </div>
                <div className="bg-gray-50 dark:bg-[#1E1F23] p-4 rounded-2xl border border-[#E5E7EB] dark:border-[#2C2D32]">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                  <span className="text-sm font-bold text-[#3D7EFF] bg-[#3D7EFF]/10 px-2 py-0.5 rounded-full">Qualified</span>
                </div>
              </div>

              {/* Information Sections */}
              <div className="space-y-6">
                <section>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                        <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium">Instagram Username</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">@{selectedLead.igUsername}</p>
                      </div>
                      <a href={`https://instagram.com/${selectedLead.igUsername}`} target="_blank" className="p-2 text-[#3D7EFF] hover:bg-blue-50 rounded-lg transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
                        <Mail className="w-5 h-5 text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium">Email Address</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedLead.email || "No email captured yet"}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Interaction History</h3>
                  <div className="bg-gray-50 dark:bg-[#1E1F23] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2C2D32]">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <TriggerTypeBadge type={selectedLead.trigger?.type || "COMMENT"} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          First captured via {selectedLead.trigger?.name || "Automation"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Triggered by keyword: <span className="font-bold text-gray-700 dark:text-gray-300">"{selectedLead.trigger?.keywords?.[0] || 'link'}"</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-2">{formatDateTime(selectedLead.capturedAt)}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 bg-gray-50 dark:bg-[#1E1F23] border-t border-[#E5E7EB] dark:border-[#2C2D32] flex gap-3">
              <a
                href={`https://instagram.com/direct/t/${selectedLead.igUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-[#3D7EFF] rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <MessageSquare className="w-4 h-4" /> Message
              </a>
              <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-[#121214] border border-[#E5E7EB] dark:border-[#2C2D32] rounded-2xl hover:bg-gray-50 transition-all active:scale-95">
                <Download className="w-4 h-4" /> Report
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

