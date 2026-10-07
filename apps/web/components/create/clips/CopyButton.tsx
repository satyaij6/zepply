"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `text`, then says so for a moment. */
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => {})
      }
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-app-line bg-white px-2.5 text-xs font-semibold text-app-ink transition hover:border-zinc-300 ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
