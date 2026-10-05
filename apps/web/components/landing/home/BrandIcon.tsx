import { useId } from "react";

export type Brand = "instagram" | "youtube" | "tiktok" | "facebook" | "whatsapp" | "x";

export const BRAND_LABELS: Record<Brand, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  x: "X",
};

const TIKTOK_PATH =
  "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

/** Single-colour marks (drawn in `currentColor`) for quiet logo rows. */
function MonoGlyph({ brand }: { brand: Brand }) {
  switch (brand) {
    case "instagram":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
        </g>
      );
    case "youtube":
      return (
        <>
          <rect y="3.5" width="24" height="17" rx="5" fill="currentColor" />
          <path d="M9.6 8.3v7.4l6.3-3.7z" fill="#fff" />
        </>
      );
    case "tiktok":
      return <path d={TIKTOK_PATH} fill="currentColor" />;
    case "facebook":
      return (
        <>
          <circle cx="12" cy="12" r="12" fill="currentColor" />
          <path d="M16.6 15.5l.5-3.4h-3.3V9.9c0-.9.5-1.8 1.9-1.8h1.5V5.2s-1.3-.2-2.6-.2c-2.7 0-4.4 1.6-4.4 4.6v2.5H7.3v3.4h2.9V24h3.6v-8.5z" fill="#fff" />
        </>
      );
    case "whatsapp":
      return (
        <>
          <path d="M12 2.4a9.6 9.6 0 0 0-8.2 14.6l.2.3-1 3.6 3.7-1 .3.2A9.6 9.6 0 1 0 12 2.4z" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <path d="M9.4 7.6c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.1.7.5 0 1.6-.6 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1a7 7 0 0 1-3.5-3c-.3-.5.3-.4.7-1.4.1-.2 0-.3 0-.5l-.9-2.1z" fill="currentColor" />
        </>
      );
    case "x":
      return <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.59-6.64 7.59H.47l8.6-9.83L0 1.15h7.59l5.25 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z" fill="currentColor" />;
  }
}

/** Platform marks, drawn on a 24×24 grid. Full colour by default; `mono` draws them in currentColor. */
export default function BrandIcon({ brand, size = 20, className, mono }: { brand: Brand; size?: number; className?: string; mono?: boolean }) {
  const gradientId = useId();
  const common = { width: size, height: size, viewBox: "0 0 24 24", className, "aria-hidden": true } as const;

  if (mono) {
    return (
      <svg {...common}>
        <MonoGlyph brand={brand} />
      </svg>
    );
  }

  switch (brand) {
    case "instagram":
      return (
        <svg {...common}>
          <defs>
            <radialGradient id={gradientId} cx="0.3" cy="1.07" r="1.15">
              <stop offset="0" stopColor="#FFD600" />
              <stop offset="0.24" stopColor="#FF7A00" />
              <stop offset="0.5" stopColor="#FF0069" />
              <stop offset="0.75" stopColor="#D300C5" />
              <stop offset="1" stopColor="#7638FA" />
            </radialGradient>
          </defs>
          <rect width="24" height="24" rx="6.5" fill={`url(#${gradientId})`} />
          <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.3" cy="7.7" r="1.05" fill="#fff" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <rect y="3.5" width="24" height="17" rx="5" fill="#FF0000" />
          <path d="M9.6 8.3v7.4l6.3-3.7z" fill="#fff" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#000" />
          <g transform="translate(4.6 4.4) scale(0.62)">
            <path d={TIKTOK_PATH} fill="#25F4EE" transform="translate(-1 -0.8)" />
            <path d={TIKTOK_PATH} fill="#FE2C55" transform="translate(1 0.8)" />
            <path d={TIKTOK_PATH} fill="#fff" />
          </g>
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#0866FF" />
          <path
            d="M16.6 15.5l.5-3.4h-3.3V9.9c0-.9.5-1.8 1.9-1.8h1.5V5.2s-1.3-.2-2.6-.2c-2.7 0-4.4 1.6-4.4 4.6v2.5H7.3v3.4h2.9V24h3.6v-8.5z"
            fill="#fff"
          />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M12 1.5a10.5 10.5 0 0 0-9.1 15.7L1.5 22.5l5.5-1.4A10.5 10.5 0 1 0 12 1.5z" fill="#25D366" />
          <path
            d="M12 3.4a8.6 8.6 0 0 0-7.3 13.1l.2.3-.8 3 3.1-.8.3.2A8.6 8.6 0 1 0 12 3.4z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
          <path
            d="M9.4 7.6c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.1.7.5 0 1.6-.6 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1a7 7 0 0 1-3.5-3c-.3-.5.3-.4.7-1.4.1-.2 0-.3 0-.5l-.9-2.1z"
            fill="#fff"
          />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path
            d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.59-6.64 7.59H.47l8.6-9.83L0 1.15h7.59l5.25 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z"
            fill="#000"
          />
        </svg>
      );
  }
}
