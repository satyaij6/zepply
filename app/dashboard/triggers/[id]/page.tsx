"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { TriggerTypeBadge } from "@/components/triggers/TriggerTypeSelector";
import { TriggerSlideOver } from "@/components/triggers/TriggerSlideOver";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2, Zap, Users, Send, Link as LinkIcon, Shield } from "lucide-react";
import Link from "next/link";

export default function TriggerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [trigger, setTrigger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTrigger();
  }, [params.id]);

  const fetchTrigger = async () => {
    try {
      const res = await fetch(`/api/triggers/${params.id}`);
      if (res.ok) {
        setTrigger(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: any) => {
    const res = await fetch(`/api/triggers/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update");
    await fetchTrigger();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/triggers/${params.id}`, { method: "DELETE" });
      router.push("/dashboard/triggers");
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
    );
  }

  if (!trigger) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Trigger not found.</p>
        <Link href="/dashboard/triggers" className="text-purple-600 text-sm mt-2 inline-block">
          ← Back to triggers
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/triggers"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to triggers
        </Link>

        <PageHeader
          title={`${trigger.type.replace("_", " ")} Trigger`}
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trigger Config */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Configuration</h3>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Type:</span>
              <TriggerTypeBadge type={trigger.type} />
            </div>

            {trigger.keywords.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-24 mt-0.5">Keywords:</span>
                <div className="flex flex-wrap gap-1">
                  {trigger.keywords.map((kw: string) => (
                    <span key={kw} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-sm font-medium">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 w-24 mt-0.5">Reply:</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                {trigger.replyMessage}
              </p>
            </div>

            {trigger.deliverLink && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Link:</span>
                <a href={trigger.deliverLink} target="_blank" className="text-sm text-purple-600 hover:underline inline-flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> {trigger.deliverLink}
                </a>
              </div>
            )}

            {trigger.followGate && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Gate:</span>
                <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                  <Shield className="w-3 h-3" /> Follow required
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Status:</span>
              <span className={`text-sm font-medium ${trigger.isActive ? "text-green-600" : "text-gray-400"}`}>
                {trigger.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Performance</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Total Hits
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{trigger.hitCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Leads
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{trigger._count?.leads || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Send className="w-4 h-4" /> DMs Sent
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{trigger.hitCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      {trigger.leads && trigger.leads.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Leads from this Trigger</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="pb-3 font-medium">Username</th>
                  <th className="pb-3 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {trigger.leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 font-medium text-gray-900 dark:text-white">
                      @{lead.igUsername}
                    </td>
                    <td className="py-3 text-gray-500">{formatDateTime(lead.capturedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Slide-over */}
      <TriggerSlideOver
        isOpen={editing}
        onClose={() => setEditing(false)}
        onSave={handleSave}
        initialData={{
          type: trigger.type,
          keywords: trigger.keywords,
          replyMessage: trigger.replyMessage,
          deliverLink: trigger.deliverLink || "",
          followGate: trigger.followGate,
        }}
        igAccountId={trigger.igAccountId}
      />

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this trigger?"
        description="All auto-replies from this trigger will stop immediately. Existing leads are preserved."
        confirmText="Delete Trigger"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
