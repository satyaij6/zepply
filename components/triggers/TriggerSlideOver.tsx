"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { TriggerTypeSelector } from "./TriggerTypeSelector";
import { KeywordInput } from "./KeywordInput";

interface TriggerFormData {
  type: string;
  keywords: string[];
  replyMessage: string;
  deliverLink: string;
  followGate: boolean;
}

interface TriggerSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TriggerFormData) => Promise<void>;
  initialData?: TriggerFormData;
  igAccountId: string;
}

const defaults: TriggerFormData = {
  type: "COMMENT",
  keywords: [],
  replyMessage: "",
  deliverLink: "",
  followGate: false,
};

export function TriggerSlideOver({
  isOpen,
  onClose,
  onSave,
  initialData,
  igAccountId,
}: TriggerSlideOverProps) {
  const [form, setForm] = useState<TriggerFormData>(initialData || defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(initialData || defaults);
      setError("");
    }
  }, [isOpen, initialData]);

  const showKeywords = form.type === "COMMENT" || form.type === "DM_KEYWORD";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.replyMessage.trim()) {
      setError("Reply message is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save trigger");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white dark:bg-gray-950 z-50 shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? "Edit Trigger" : "New Trigger"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Trigger Type
            </label>
            <TriggerTypeSelector
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
            />
          </div>

          {/* Keywords */}
          {showKeywords && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Keywords
              </label>
              <KeywordInput
                keywords={form.keywords}
                onChange={(keywords) => setForm({ ...form, keywords })}
              />
              <p className="text-xs text-gray-400 mt-1">
                When someone {form.type === "COMMENT" ? "comments" : "DMs"} any of these words, Zepply replies instantly.
              </p>
            </div>
          )}

          {/* Reply Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reply Message
            </label>
            <textarea
              value={form.replyMessage}
              onChange={(e) => setForm({ ...form, replyMessage: e.target.value })}
              maxLength={500}
              rows={4}
              placeholder="Hey! Here's the link you asked for 👉"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {form.replyMessage.length}/500
            </p>
          </div>

          {/* Deliver Link */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Deliver a Link
              </label>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, deliverLink: form.deliverLink ? "" : "https://" })
                }
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  form.deliverLink
                    ? "bg-purple-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    form.deliverLink ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            {form.deliverLink !== "" && (
              <input
                type="url"
                value={form.deliverLink}
                onChange={(e) => setForm({ ...form, deliverLink: e.target.value })}
                placeholder="https://your-link.com/guide"
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            )}
            <p className="text-xs text-gray-400 mt-1">
              Zepply will append this link to the reply.
            </p>
          </div>

          {/* Follow Gate (Comment only) */}
          {form.type === "COMMENT" && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Follow Gate
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Only reply if the commenter already follows you.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, followGate: !form.followGate })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  form.followGate
                    ? "bg-purple-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    form.followGate ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          )}

          {/* Phase 2 stubs */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
            <div className="opacity-40 pointer-events-none flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Use AI Reply
                </p>
                <p className="text-xs text-gray-400">Pro — coming soon</p>
              </div>
              <div className="relative w-10 h-5 rounded-full bg-gray-200 dark:bg-gray-700">
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>
            <div className="opacity-40 pointer-events-none flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  WhatsApp Handoff
                </p>
                <p className="text-xs text-gray-400">Pro — coming soon</p>
              </div>
              <div className="relative w-10 h-5 rounded-full bg-gray-200 dark:bg-gray-700">
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : initialData ? "Update Trigger" : "Create Trigger"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
