"use client";

import { Menu, Bell } from "lucide-react";

interface TopBarProps {
  onMenuClick: () => void;
  igAccount?: {
    igUsername: string;
    igProfilePic?: string | null;
  } | null;
}

export function TopBar({ onMenuClick, igAccount }: TopBarProps) {
  return (
    <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center">
          <span className="text-white font-bold text-xs">Z</span>
        </div>
        <span className="text-base font-bold text-gray-900 dark:text-white">Zepply</span>
      </div>

      {/* Spacer for desktop */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 relative">
          <Bell className="w-5 h-5" />
        </button>

        {igAccount && (
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-gray-800">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center overflow-hidden">
              {igAccount.igProfilePic ? (
                <img
                  src={igAccount.igProfilePic}
                  alt={igAccount.igUsername}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-purple-600">
                  {igAccount.igUsername.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
              @{igAccount.igUsername}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
