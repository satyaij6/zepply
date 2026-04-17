"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { TriggerCard } from "@/components/triggers/TriggerCard";
import { TriggerSlideOver } from "@/components/triggers/TriggerSlideOver";
import { Zap, Plus } from "lucide-react";

const filterTabs = [
  { value: "", label: "All" },
  { value: "COMMENT", label: "Comment" },
  { value: "DM_KEYWORD", label: "DM" },
  { value: "STORY_REPLY", label: "Story Reply" },
  { value: "NEW_FOLLOWER", label: "New Follower" },
];

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [igAccountId, setIgAccountId] = useState("");

  useEffect(() => {
    fetchTriggers();
    fetchIgAccount();
  }, [filter]);

  const fetchIgAccount = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        if (data.igAccount) {
          // We need the igAccount ID, fetch from settings
          const settingsRes = await fetch("/api/settings");
          if (settingsRes.ok) {
            const user = await settingsRes.json();
            if (user.igAccounts?.[0]) {
              setIgAccountId(user.igAccounts[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTriggers = async () => {
    try {
      const params = filter ? `?type=${filter}` : "";
      const res = await fetch(`/api/triggers${params}`);
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
    try {
      const res = await fetch(`/api/triggers/${id}`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setTriggers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isActive: updated.isActive } : t))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (data: any) => {
    const isEdit = !!editingTrigger;
    const url = isEdit ? `/api/triggers/${editingTrigger.id}` : "/api/triggers";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, igAccountId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save");
    }

    await fetchTriggers();
    setEditingTrigger(null);
  };

  const handleEdit = (trigger: any) => {
    setEditingTrigger(trigger);
    setSlideOverOpen(true);
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
    <DashboardLayout>
      <PageHeader
        title="Triggers"
        description="Auto-reply to comments, DMs, story replies, and new followers."
        action={
          <button
            onClick={() => {
              setEditingTrigger(null);
              setSlideOverOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Trigger
          </button>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              filter === tab.value
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Triggers list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : triggers.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-8 h-8 text-purple-500" />}
          title="No triggers yet"
          description="Create your first trigger to auto-reply to comments, DMs, and more."
          action={
            <button
              onClick={() => setSlideOverOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Your First Trigger
            </button>
          }
        />
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

      {/* Slide-over */}
      <TriggerSlideOver
        isOpen={slideOverOpen}
        onClose={() => {
          setSlideOverOpen(false);
          setEditingTrigger(null);
        }}
        onSave={handleSave}
        initialData={
          editingTrigger
            ? {
                type: editingTrigger.type,
                keywords: editingTrigger.keywords,
                replyMessage: editingTrigger.replyMessage,
                deliverLink: editingTrigger.deliverLink || "",
                followGate: editingTrigger.followGate,
              }
            : undefined
        }
        igAccountId={igAccountId}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Trigger"
        description="Are you sure? This will stop all auto-replies from this trigger. Existing leads will be preserved."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </DashboardLayout>
  );
}
