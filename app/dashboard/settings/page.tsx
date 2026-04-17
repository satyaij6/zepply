"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { formatDate } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { Save, RefreshCw, Unplug, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setName(data.name || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    try {
      await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      signOut({ callbackUrl: "/" });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader title="Settings" description="Manage your account and preferences." />

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-400 cursor-not-allowed"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Connected Instagram */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Connected Instagram Account
          </h3>
          {user?.igAccounts?.length > 0 ? (
            <div className="space-y-4">
              {user.igAccounts.map((acc: any) => (
                <div key={acc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center overflow-hidden">
                      {acc.igProfilePic ? (
                        <img src={acc.igProfilePic} alt={acc.igUsername} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-purple-600">{acc.igUsername.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">@{acc.igUsername}</p>
                      <p className="text-xs text-gray-400">Connected {formatDate(acc.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="/api/instagram/connect"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <RefreshCw className="w-3 h-3" /> Reconnect
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <a
              href="/api/instagram/connect"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-lg hover:opacity-90 transition-opacity"
            >
              Connect Instagram
            </a>
          )}
        </div>

        {/* Default Reply Settings */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Default Reply Settings
          </h3>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              Default reply language
            </label>
            <select className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none">
              <option value="english">English</option>
              <option value="hindi-english">Hindi + English</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Used for AI replies in Phase 2.</p>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Notifications</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Email me when new lead captured</span>
              <button className="relative w-10 h-5 rounded-full bg-purple-600">
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow translate-x-5" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Daily summary email</span>
              <button className="relative w-10 h-5 rounded-full bg-gray-200 dark:bg-gray-700">
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-red-200 dark:border-red-900/50 p-6">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Permanently delete your account and all data. This cannot be undone.
          </p>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Delete your account?
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Type <strong>DELETE</strong> to confirm. This will permanently remove your account, triggers, and leads.
              </p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder='Type "DELETE"'
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm mb-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== "DELETE"}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-50"
                >
                  Delete My Account
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
