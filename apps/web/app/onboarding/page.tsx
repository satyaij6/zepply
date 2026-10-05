"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Camera, Zap, MessageCircle, PartyPopper, ArrowRight, SkipForward } from "lucide-react";
import { TriggerTypeSelector } from "@/components/triggers/TriggerTypeSelector";
import { KeywordInput } from "@/components/triggers/KeywordInput";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [igAccount, setIgAccount] = useState<any>(null);
  const [igAccountId, setIgAccountId] = useState("");

  // Step 2: First trigger
  const [triggerType, setTriggerType] = useState("COMMENT");
  const [triggerKeywords, setTriggerKeywords] = useState(["GUIDE"]);
  const [triggerReply, setTriggerReply] = useState("Hey! Here's the link you asked for 👉");
  const [triggerLink, setTriggerLink] = useState("");

  // Step 3: Welcome message
  const [welcomeMsg, setWelcomeMsg] = useState(
    "Hey! Thanks for following 🙌 I share helpful tips here. DM me 'START' if you want my free guide!"
  );

  // Created triggers for summary
  const [createdTriggers, setCreatedTriggers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if user has IG account connected
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const user = await res.json();
        if (user.igAccounts?.length > 0) {
          setIgAccount(user.igAccounts[0]);
          setIgAccountId(user.igAccounts[0].id);
          setStep(2); // Skip step 1 if already connected
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTrigger = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igAccountId,
          type: triggerType,
          keywords: triggerKeywords,
          replyMessage: triggerReply + (triggerLink ? `\n\n${triggerLink}` : ""),
          deliverLink: triggerLink || null,
        }),
      });
      if (res.ok) {
        const trigger = await res.json();
        setCreatedTriggers((prev) => [...prev, trigger]);
        setStep(3);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWelcome = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igAccountId,
          type: "NEW_FOLLOWER",
          keywords: [],
          replyMessage: welcomeMsg,
        }),
      });
      if (res.ok) {
        const trigger = await res.json();
        setCreatedTriggers((prev) => [...prev, trigger]);
        setStep(4);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Zepply</span>
          </div>
          <span className="text-sm text-gray-400">Step {step} of 4</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto">
          <div className="h-1 bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full bg-purple-600 transition-all duration-500"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-20">
        <div className="w-full max-w-lg">
          {/* Step 1: Connect Instagram */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-6">
                <Camera className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Connect your Instagram
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                Zepply links to your Instagram Business account via Meta&apos;s official API. No bans, ever.
              </p>
              <a
                href="/api/instagram/connect"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg text-lg"
              >
                <Camera className="w-5 h-5" />
                Connect Instagram
              </a>
              <button
                onClick={() => setStep(2)}
                className="block mx-auto mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <SkipForward className="w-4 h-4 inline mr-1" /> Skip for now
              </button>
            </div>
          )}

          {/* Step 2: First trigger */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Create your first trigger
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  When someone comments a keyword, Zepply replies instantly.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trigger Type
                  </label>
                  <TriggerTypeSelector value={triggerType} onChange={setTriggerType} />
                </div>

                {(triggerType === "COMMENT" || triggerType === "DM_KEYWORD") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Keywords
                    </label>
                    <KeywordInput keywords={triggerKeywords} onChange={setTriggerKeywords} />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reply Message
                  </label>
                  <textarea
                    value={triggerReply}
                    onChange={(e) => setTriggerReply(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right">{triggerReply.length}/500</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Link to deliver (optional)
                  </label>
                  <input
                    type="url"
                    value={triggerLink}
                    onChange={(e) => setTriggerLink(e.target.value)}
                    placeholder="https://your-guide-link.com"
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Skip
                </button>
                <button
                  onClick={handleSaveTrigger}
                  disabled={saving || !triggerReply.trim()}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? "Creating..." : "Create & Continue"} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Welcome message */}
          {step === 3 && (
            <div>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome new followers
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Zepply will DM this message to every new follower.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <textarea
                  value={welcomeMsg}
                  onChange={(e) => setWelcomeMsg(e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{welcomeMsg.length}/500</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Skip
                </button>
                <button
                  onClick={handleSaveWelcome}
                  disabled={saving || !welcomeMsg.trim()}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? "Saving..." : "Save & Continue"} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-6">
                <PartyPopper className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                You&apos;re live! 🎉
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Zepply is now watching your Instagram. Auto-replies are active.
              </p>

              {/* Summary */}
              {createdTriggers.length > 0 && (
                <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Triggers created:
                  </p>
                  {createdTriggers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{t.type.replace("_", " ")}</span>
                      {t.keywords?.length > 0 && (
                        <span className="text-purple-600">({t.keywords.join(", ")})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors shadow-lg"
              >
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </Link>

              <div className="mt-6">
                <p className="text-sm text-gray-400 mb-2">Share Zepply with a friend</p>
                <div className="flex justify-center gap-3">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Just set up @ZepplyApp to auto-reply on my Instagram. Free and actually works! 🚀 https://zepply.app")}`}
                    target="_blank"
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Share on X
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent("Check out Zepply - free Instagram auto-reply tool! https://zepply.app")}`}
                    target="_blank"
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Share on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
