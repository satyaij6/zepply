"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { TriggerCard } from "@/components/triggers/TriggerCard";
import { NewAutomationModal } from "@/components/dashboard/NewAutomationModal";
import { Zap, Plus } from "lucide-react";

const filterTabs = [
  { value: "", label: "All" },
  { value: "COMMENT", label: "Comment" },
  { value: "DM_KEYWORD", label: "DM" },
  { value: "STORY_REPLY", label: "Story Reply" },
  { value: "NEW_FOLLOWER", label: "New Follower" },
];

export default function TriggersPage() {
  const router = useRouter();
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
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
      if (res.ok) {
        setTriggers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    // Optimistic update — flip immediately for instant feedback
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t))
    );
    try {
      const res = await fetch(`/api/triggers/${id}`, { method: "PATCH" });
      if (!res.ok) {
        // Revert on failure
        setTriggers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t))
        );
      }
    } catch (err) {
      console.error(err);
      // Revert on error
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

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1B4C]">Automations</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Auto-reply to comments, DMs, story replies, and new followers.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#2564FF] text-white rounded-full text-[13px] font-medium hover:opacity-90 transition-all duration-150 active:scale-90 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" /> New Automation
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
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

      {/* Triggers list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-[#E5E7EB] animate-pulse" />
          ))}
        </div>
      ) : triggers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-[#3D7EFF]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#0F1B4C] mb-2">No automations yet</h3>
          <p className="text-[14px] text-[#6B7280] mb-6 max-w-md">
            Create your first automation to auto-reply to comments, DMs, and grow your audience.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#3D7EFF] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Create Your First Automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
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
