"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { NewAutomationModal } from "@/components/dashboard/NewAutomationModal";
import { TriggerTypeBadge } from "@/components/triggers/TriggerTypeSelector";
import { formatDate } from "@/lib/utils";
import {
  Zap, Plus, Search, RefreshCw, Pencil, Trash2, Play, Pause,
  MessageCircle, AtSign, BookOpen, UserPlus, ChevronDown,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: any; gradient: string; label: string }> = {
  COMMENT: { icon: MessageCircle, gradient: "from-[#A855F7] to-[#EC4899]", label: "Comment Reply" },
  DM_KEYWORD: { icon: AtSign, gradient: "from-[#3D7EFF] to-[#06B6D4]", label: "DM Keyword" },
  STORY_REPLY: { icon: BookOpen, gradient: "from-[#22C55E] to-[#10B981]", label: "Story Reply" },
  NEW_FOLLOWER: { icon: UserPlus, gradient: "from-[#F97316] to-[#F59E0B]", label: "New Follower" },
};

const filterTabs = [
  { value: "", label: "All" },
  { value: "COMMENT", label: "Comment" },
  { value: "DM_KEYWORD", label: "DM" },
  { value: "STORY_REPLY", label: "Story Reply" },
  { value: "NEW_FOLLOWER", label: "New Follower" },
];

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "active", label: "Live" },
  { value: "inactive", label: "Paused" },
];

export default function TriggersPage() {
  const router = useRouter();
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTriggers();
  }, [filter]);

  const fetchTriggers = async () => {
    setLoading(true);
    try {
      const params = filter ? `?type=${filter}` : "";
      const res = await fetch(`/api/triggers${params}`, { cache: "no-store" });
      if (res.ok) setTriggers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t))
    );
    try {
      const res = await fetch(`/api/triggers/${id}`, { method: "PATCH" });
      if (!res.ok) {
        setTriggers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t))
        );
      }
    } catch {
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t))
      );
    }
  };

  const handleEdit = (trigger: any) => {
    router.push(`/dashboard/triggers/${trigger.id}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/triggers/${deleteId}`, { method: "DELETE" });
      setTriggers((prev) => prev.filter((t) => t.id !== deleteId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const visible = triggers.filter((t) => {
    if (statusFilter === "active" && !t.isActive) return false;
    if (statusFilter === "inactive" && t.isActive) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name = (t.name || "").toLowerCase();
      const keywords = (t.keywords || []).join(" ").toLowerCase();
      const reply = (t.replyMessage || "").toLowerCase();
      if (!name.includes(q) && !keywords.includes(q) && !reply.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1B4C]">Automations</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage all your active and inactive automations.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchTriggers}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E7EB] text-[#374151] rounded-full text-[13px] font-medium hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors active:scale-95"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2564FF] text-white rounded-full text-[13px] font-medium hover:opacity-90 transition-all duration-150 active:scale-90"
          >
            <Plus className="w-3.5 h-3.5" /> New Automation
          </button>
        </div>
      </div>

      {/* Toolbar — search + status */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search automations..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#0F1B4C] placeholder-[#9CA3AF] focus:outline-none focus:border-[#3D7EFF] focus:ring-2 focus:ring-[#3D7EFF]/15 transition-all"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            onBlur={() => setTimeout(() => setStatusOpen(false), 120)}
            className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#0F1B4C] hover:border-[#3D7EFF] transition-colors min-w-[150px]"
          >
            <span>{statusOptions.find((s) => s.value === statusFilter)?.label}</span>
            <ChevronDown
              className={`w-4 h-4 text-[#9CA3AF] transition-transform ${statusOpen ? "rotate-180" : ""}`}
            />
          </button>
          {statusOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-10 overflow-hidden">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setStatusOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#F9FAFB] transition-colors ${
                    statusFilter === opt.value ? "text-[#3D7EFF] font-semibold" : "text-[#374151]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
              filter === tab.value
                ? "bg-[#3D7EFF] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#3D7EFF] hover:text-[#3D7EFF]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table / states */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[68px] border-b border-[#F3F4F6] last:border-b-0 animate-pulse bg-[#FAFBFC]"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-[#3D7EFF]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#0F1B4C] mb-2">
            {triggers.length === 0 ? "No automations yet" : "No matches"}
          </h3>
          <p className="text-[14px] text-[#6B7280] mb-6 max-w-md">
            {triggers.length === 0
              ? "Create your first automation to auto-reply to comments, DMs, and grow your audience."
              : "Try adjusting your search or filters to find what you're looking for."}
          </p>
          {triggers.length === 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#3D7EFF] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Create Your First Automation
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header row */}
              <div className="grid grid-cols-[minmax(0,3fr)_1.2fr_0.7fr_0.7fr_1fr_1fr_auto] gap-4 px-6 py-3.5 border-b border-[#F3F4F6] bg-[#FAFBFC]">
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Automation</div>
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Type</div>
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Runs</div>
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Leads</div>
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Status</div>
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">Last Updated</div>
                <div className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase text-right pr-2">Actions</div>
              </div>

              {/* Rows */}
              {visible.map((trigger) => {
                const config = TYPE_CONFIG[trigger.type] || TYPE_CONFIG.COMMENT;
                const Icon = config.icon;
                const displayName =
                  trigger.name ||
                  (trigger.keywords?.[0]
                    ? `${config.label}: '${trigger.keywords[0]}'`
                    : config.label);

                return (
                  <div
                    key={trigger.id}
                    className="grid grid-cols-[minmax(0,3fr)_1.2fr_0.7fr_0.7fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#FAFBFC] transition-colors items-center"
                  >
                    {/* Automation thumbnail + name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#0F1B4C] truncate">
                          {displayName}
                        </p>
                        {trigger.keywords?.length > 0 && (
                          <p className="text-[12px] text-[#9CA3AF] truncate mt-0.5">
                            Keywords: {trigger.keywords.slice(0, 3).join(", ")}
                            {trigger.keywords.length > 3 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Type */}
                    <div>
                      <TriggerTypeBadge type={trigger.type} />
                    </div>

                    {/* Runs */}
                    <div className="text-[14px] font-semibold text-[#0F1B4C] tabular-nums">
                      {trigger.hitCount || 0}
                    </div>

                    {/* Leads */}
                    <div className="text-[14px] font-semibold text-[#0F1B4C] tabular-nums">
                      {trigger._count?.leads || 0}
                    </div>

                    {/* Status pill (clickable to toggle) */}
                    <div>
                      <button
                        onClick={() => handleToggle(trigger.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          trigger.isActive
                            ? "bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0]"
                            : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                        }`}
                        title={trigger.isActive ? "Click to pause" : "Click to resume"}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            trigger.isActive ? "bg-[#16A34A]" : "bg-[#9CA3AF]"
                          }`}
                        />
                        {trigger.isActive ? "Live" : "Paused"}
                      </button>
                    </div>

                    {/* Last updated */}
                    <div className="text-[13px] text-[#6B7280]">
                      {trigger.updatedAt ? formatDate(trigger.updatedAt) : "—"}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 justify-end">
                      <button
                        onClick={() => handleEdit(trigger)}
                        className="p-2 rounded-lg hover:bg-[#EEF2FF] text-[#9CA3AF] hover:text-[#3D7EFF] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(trigger.id)}
                        className="p-2 rounded-lg hover:bg-[#FEF9C3] text-[#9CA3AF] hover:text-[#F59E0B] transition-colors"
                        title={trigger.isActive ? "Pause" : "Resume"}
                      >
                        {trigger.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteId(trigger.id)}
                        className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New Automation Modal */}
      <NewAutomationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Automation"
        description="Are you sure? This will stop all auto-replies from this automation. Existing leads will be preserved."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
