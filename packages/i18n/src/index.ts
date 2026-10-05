// UI strings for web and mobile. English is the source of truth; Telugu and
// Hindi catalogues are filled in by native speakers — any missing key falls
// back to English, so a partial catalogue never breaks the UI.

export const locales = ["en", "te", "hi"] as const;
export type Locale = (typeof locales)[number];

const en = {
  "brand.tagline": "Create. Reply. Multiply.",
  "nav.howItWorks": "How it works",
  "nav.useCases": "Use Cases",
  "nav.pricing": "Pricing",
  "nav.learn": "Learn",
  "cta.joinWaitlist": "Join the waitlist",
  "onboarding.chooseAudience": "What best describes you?",
  "onboarding.creator": "I'm a creator",
  "onboarding.business": "I'm a business",
} as const;

export type MessageKey = keyof typeof en;

const catalogues: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
  te: {},
  hi: {},
};

export function t(locale: Locale, key: MessageKey): string {
  return catalogues[locale][key] ?? en[key];
}
