"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}

export function KeywordInput({ keywords, onChange }: KeywordInputProps) {
  const [input, setInput] = useState("");

  const addKeyword = (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed && !keywords.includes(trimmed)) {
      onChange([...keywords, trimmed]);
    }
    setInput("");
  };

  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(input);
    }
    if (e.key === "Backspace" && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[44px] focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-sm font-medium"
          >
            {kw}
            <button
              type="button"
              onClick={() => removeKeyword(kw)}
              className="hover:text-purple-900 dark:hover:text-purple-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && addKeyword(input)}
          placeholder={keywords.length === 0 ? "Type keyword + Enter" : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        Press Enter or comma to add. Keywords are case-insensitive.
      </p>
    </div>
  );
}
