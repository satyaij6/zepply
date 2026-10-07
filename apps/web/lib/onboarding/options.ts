/*
 * What onboarding (/start) offers, in one place for the API and the wizard.
 * Safe to import from client components: no server-only code here.
 */
import { LANGUAGES } from "@/lib/reels/options";

export { LANGUAGES };
export type Language = (typeof LANGUAGES)[number]["value"];

export const STEPS = [
  { label: "Choose", sub: "your path" },
  { label: "About", sub: "you" },
  { label: "Connect", sub: "your brand" },
  { label: "Review", sub: "brand kit" },
  { label: "Your first", sub: "content" },
] as const;
/** Step 6 is the "you're all set" screen after the five above */
export const LAST_STEP = 6;

export const PATHS = [
  {
    value: "creator",
    label: "Creator",
    lede: "Grow your audience with content, clips and Reels.",
    tags: ["Influencers", "Educators", "Podcasters", "Coaches", "Personal brands"],
  },
  {
    value: "business",
    label: "Business",
    lede: "Turn your marketing into conversations and customers.",
    tags: ["Local businesses", "D2C brands", "Real estate", "Clinics", "Restaurants", "Gyms & fitness"],
  },
] as const;
export type Path = (typeof PATHS)[number]["value"];

export const CREATOR_NICHES = [
  { value: "personal-brand", label: "Personal brand", hint: "Your journey, lifestyle, thoughts and expertise" },
  { value: "education", label: "Education", hint: "Teach and share knowledge" },
  { value: "podcast", label: "Podcast", hint: "Turn long-form content into short clips" },
  { value: "coaching", label: "Coaching", hint: "Help and guide others" },
  { value: "entertainment", label: "Entertainment", hint: "Create fun and engaging content" },
  { value: "other", label: "Other", hint: "Something else" },
] as const;

export const BUSINESS_TYPES = [
  { value: "cafe-restaurant", label: "Café & restaurant", hint: "Food, drinks and dining" },
  { value: "retail", label: "Shop & retail", hint: "A store, online or on the street" },
  { value: "clinic", label: "Clinic & health", hint: "Doctors, dentists, wellness" },
  { value: "fitness", label: "Gym & fitness", hint: "Gyms, studios, trainers" },
  { value: "real-estate", label: "Real estate", hint: "Properties and projects" },
  { value: "d2c", label: "Online / D2C brand", hint: "You sell your own products online" },
  { value: "services", label: "Services", hint: "Salons, agencies, coaching and more" },
  { value: "other", label: "Other", hint: "Something else" },
] as const;

export const CREATOR_GOALS = [
  { value: "grow-followers", label: "Grow followers", hint: "Reach more people" },
  { value: "more-reach", label: "Get more reach", hint: "Increase views and visibility" },
  { value: "post-consistently", label: "Post consistently", hint: "Save time and stay consistent" },
  { value: "more-engagement", label: "Get more engagement", hint: "More likes, comments and shares" },
] as const;

export const BUSINESS_GOALS = [
  { value: "more-leads", label: "More enquiries", hint: "Turn comments and DMs into leads" },
  { value: "more-bookings", label: "More bookings & walk-ins", hint: "Fill your calendar and your space" },
  { value: "sell-more", label: "Sell more products", hint: "Show what you sell, well" },
  { value: "more-reach", label: "Reach more people", hint: "Be seen by new customers nearby" },
  { value: "post-consistently", label: "Post consistently", hint: "Stay active without the effort" },
  { value: "reply-faster", label: "Reply to DMs faster", hint: "Never leave a customer waiting" },
] as const;

export const nichesFor = (path: Path | null) => (path === "business" ? BUSINESS_TYPES : CREATOR_NICHES);
export const goalsFor = (path: Path | null) => (path === "business" ? BUSINESS_GOALS : CREATOR_GOALS);

/** What Zepply will make for each goal, for the "Example for your goals" panel */
export const GOAL_EXAMPLES: Record<string, string> = {
  "grow-followers": "Reels about your daily journey",
  "more-reach": "Trending topics in your niche",
  "post-consistently": "A two-week content calendar",
  "more-engagement": "Carousels that share what you've learned",
  "more-leads": "Auto-replies when someone comments “price”",
  "more-bookings": "Posts that invite people in this week",
  "sell-more": "Product spotlights from your photos",
  "reply-faster": "Instant answers to common DMs",
};

/** Headline typefaces for designs. Each is a Google font, loaded when post images are drawn. */
export const FONTS = [
  { value: "inter-tight", label: "Inter Tight", family: "Inter Tight", note: "Clean · Modern · Bold" },
  { value: "plus-jakarta", label: "Plus Jakarta Sans", family: "Plus Jakarta Sans", note: "Clean · Modern · Friendly" },
  { value: "poppins", label: "Poppins", family: "Poppins", note: "Round · Friendly · Playful" },
  { value: "playfair", label: "Playfair Display", family: "Playfair Display", note: "Classic · Elegant · Premium" },
  { value: "instrument-serif", label: "Instrument Serif", family: "Instrument Serif", note: "Editorial · Warm · Refined" },
] as const;
export type FontValue = (typeof FONTS)[number]["value"];

export const MAX_COLORS = 4;
export const MAX_TAGS = 6;
