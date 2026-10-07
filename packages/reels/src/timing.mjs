// Scene windows and sound cues for the promo-classic template.
//
// Every cut sits on the 120 BPM grid (one beat = 0.5 s) that the music beds in
// packages/reels/audio/generate.py are written against. Change a time here and
// the TIMING table in generate.py must change with it (then regenerate audio).

export const BEAT = 0.5;

/** @type {Record<"standard" | "short", { duration: number, scenes: { id: string, start: number, end: number }[] }>} */
export const LENGTHS = {
  standard: {
    duration: 30,
    scenes: [
      { id: "hook", start: 0, end: 4 },
      { id: "answer", start: 4, end: 9.5 },
      { id: "gallery", start: 9.5, end: 15 },
      { id: "highlights", start: 15, end: 20 },
      { id: "tagline", start: 20, end: 24 },
      { id: "cta", start: 24, end: 30 },
    ],
  },
  short: {
    duration: 15,
    scenes: [
      { id: "hook", start: 0, end: 3 },
      { id: "answer", start: 3, end: 7.5 },
      { id: "tagline", start: 7.5, end: 11 },
      { id: "cta", start: 11, end: 15 },
    ],
  },
};

/**
 * Sound cues, in seconds from the start of their scene. `at` may be a function of
 * the scene length so cues that belong to a scene's exit stay at its tail.
 * @type {Record<string, { file: string, at: number | ((len: number) => number), volume: number }[]>}
 */
export const SFX = {
  hook: [
    { file: "notification", at: 0.5, volume: 0.28 },
    { file: "pop", at: 1.0, volume: 0.22 },
    { file: "pop", at: 1.5, volume: 0.18 },
    { file: "whoosh", at: (len) => len - 0.8, volume: 0.3 },
  ],
  answer: [
    { file: "typing", at: 1.3, volume: 0.16 },
    { file: "ping", at: 2.35, volume: 0.26 },
    { file: "click-soft", at: 3.9, volume: 0.3 },
  ],
  gallery: [
    { file: "pop", at: 0.2, volume: 0.25 },
    { file: "click-soft", at: 1.0, volume: 0.25 },
    { file: "sparkle", at: 3.0, volume: 0.22 },
  ],
  highlights: [
    { file: "pop", at: 0.2, volume: 0.25 },
    { file: "click-soft", at: 1.25, volume: 0.25 },
    { file: "click-soft", at: 2.0, volume: 0.25 },
  ],
  tagline: [{ file: "whoosh", at: (len) => len - 0.6, volume: 0.28 }],
  cta: [
    { file: "sparkle", at: 0.9, volume: 0.22 },
    { file: "click", at: 2.6, volume: 0.32 },
  ],
};

export const SFX_DURATIONS = {
  pop: 0.16,
  click: 0.06,
  "click-soft": 0.06,
  whoosh: 0.55,
  ping: 1.1,
  notification: 0.5,
  typing: 1.2,
  impact: 1.3,
  sparkle: 1.2,
  riser: 1.5,
};
