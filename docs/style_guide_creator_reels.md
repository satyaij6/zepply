# Style guide: "Creator Reels" (the comment-for-the-link explainer)

A reusable playbook for Zepply users, measured from six Instagram reels by
Indian creators (all 720×1280, 17–60 s, about 3.7 minutes in total), studied
frame by frame. Frames and cut data are in `refs/creator-reels/` (git-ignored);
the reels themselves stay in the user's own folder. We take the **format and
grammar**, not anyone's words, footage or branding.

This is the dominant format for creators and small businesses on Instagram
right now: someone explains **one useful thing** (an offer, a tool, a how-to),
shows proof on screen, gives the steps, and ends with **"Comment WORD and I'll
DM you the link."** Every one of the six reels ends that way, which is exactly
what Zepply's comment→DM automation delivers.

Siblings: [Clean Product Explainer](style_guide.md),
[Signal Grid](style_guide_signal_grid.md),
[Creator Kinetic](style_guide_creator_kinetic.md).

---

## 1. The anatomy (every reel follows it)

| Part | Time | What happens | Seen in |
|---|---|---|---|
| **Hook** | 0–3 s | The claim with a number, plus a visual that proves it is real: "$1000 free …", "1 YEAR", "Clone your voice for free" | all 6 |
| **What it is** | 3–10 s | The offer or tool as a clean card, an app icon, or an illustrated mock-up | all 6 |
| **Proof** | 5–20 s | A screenshot of the official page with the key line highlighted, a tweet from someone who got it, or a screen recording | 5 of 6 |
| **How** | 10–40 s | Steps: "Step one / Step two", a form being filled in, sign-in, "decision in minutes" | 4 of 6 |
| **Urgency** | late | "Don't miss this offer", "Who can apply?", a ticking timer | 3 of 6 |
| **CTA** | last 2–4 s | **"Comment WORD"** in huge type ("for the link"), plus "follow for more" | **6 of 6** |

Rules:
- **The hook is a number or a "free".** Money, time or a count, said in the
  first second and shown on screen at the same moment.
- **Proof comes before steps.** Viewers believe it first and act on it second.
- **The CTA keyword is one short word** tied to the topic (CLAUDE, CODE,
  CLONE, STARTUP, AI). It is the biggest type in the whole reel.

## 2. Four layouts (most reels mix two or three)

**A. Full-frame talking head.** The speaker fills 9:16, with captions in the
lower third or mid-chest. It's used for the hook and personal lines ("I haven't
even registered…").

**B. Speaker card on a brand canvas (the most distinctive one).** A solid,
saturated background colour fills the frame. The speaker sits in a
**rounded-corner card** (radius ~24 px at 720 wide, 80% of the width) in the
**bottom half**, and the **top half** holds the visual: a headline, a UI card,
an icon animation or a screenshot. Captions sit between them. Three of the six
reels use it for most of their length.

**C. Full-screen visual.** A screenshot, screen recording, illustrated mock-up
or title card fills the frame, and the voice continues. The speaker may shrink
to a small floating card in a corner, or disappear.

**D. News split.** The top is a source clip or headline banner, the bottom is
the speaker. Used only for the hook (the first 3 s).

Layout changes are often **animated rather than cut**: the speaker's frame
scales down from full-frame into the card (~0.4 s), so one take reads as an
edited piece. One reel has **zero cuts in 52 s** and still feels edited,
purely from layout moves and graphics.

## 3. Palette: one brand canvas per creator

Each creator owns one canvas colour, used on every reel, which makes them
recognisable in the feed. Measured:

| Canvas | Hex | Type on it | Accent |
|---|---|---|---|
| Deep plum | `#3C1848` / `#3C1242` | Cream `#E4D2A8` | Burnt orange `#D06030` |
| Oxblood → black gradient | `#601200` → `#2A0600` | White | Caption yellow (≈ `#F5E300`) |
| Warm grey paper | `#D8D2CC` (and a black `#000000` variant) | Near-black | Coral `#E08068` |
| (Full-frame footage) | warm room, practical lamps | White | Red banner on white `#A05000`-ish orange-red |

Rules:
- **One canvas colour, one type colour, one accent.** The accent marks the
  word that matters, the check mark and the progress dot.
- **Dark, saturated canvases** (plum, oxblood) make cream or white type and
  bright UI screenshots pop. **Light paper canvases** suit calm, personal
  stories.
- For Zepply: the canvas is the Brand Kit's primary colour, darkened to around
  15–25% lightness, and the Brand Kit accent is the accent.

## 4. Captions: four systems seen (pick one per brand)

| System | Look | Best for |
|---|---|---|
| **Pill** | White semibold text in a dark grey rounded pill, one short line, centred | Calm, credible explainers |
| **Word highlight (karaoke)** | Bold white words; the word being spoken sits in a **white box with dark text** | Code-mixed Telugu/Hindi in Latin script, fast talkers |
| **Two-tier emphasis** | A small white line, then **one big word** in the accent colour (sometimes a serif italic) | Personal story reels |
| **Caps + keyword** | UPPERCASE bold white at the bottom with **one word in yellow** | Hinglish walkthroughs over screen recordings |

Rules:
- **Short:** 1–4 words on screen at a time, and never two lines of small text.
- **On the voice:** each word appears as it's spoken, synced to the word.
- **Language as spoken:** Telugu and Hindi are written in Latin script, the way
  people type them, mixed with English.
- **Placement:** in layout B, captions sit in the gap between the visual and
  the speaker card. In layout A they go mid-chest, clear of the face.

## 5. Pacing (measured)

| Reel | Length | Cuts | Median shot | Style |
|---|---|---|---|---|
| Startup program | 32 s | 6 | 3.3 s | Talking head ↔ screenshot |
| Team plan | 21 s | 4 | 5.6 s | Layout B throughout; the top panel changes every 2–4 s |
| Accepted story | 52 s | **0** | one take | Layout moves only |
| Voice clone | 17 s | 3 | 2.4 s | Icon animations, series title card |
| GitHub tool | 43 s | **19** | **1.7 s** | Fast B-roll, flashes, phone mock-ups |
| Max subscription | 60 s | 14 | 3.2 s | Long screen walkthrough, meme insert |

- **Something changes on screen every 2–4 s,** whether a cut, a layout move, a new
  card, or a new headline in the top panel. The fast reel changes every 1.7 s.
- **Best length: 20–45 s.** The 60 s reel needs a long step-by-step to
  justify it.

## 6. Motion and graphics vocabulary

- **Section headers** in the top panel: a small spaced-caps label ("HOW TO
  APPLY") above a big bold headline ("SIGN IN & APPLY"). It changes as the
  explanation moves on, like chapters.
- **Illustrated UI mock-ups** (not real screenshots): simplified forms, a
  sign-in box, a card with a check mark, drawn in the canvas palette, with
  typing and tick animations. They're cleaner than screenshots and work in any
  language.
- **Icon explainers:** simple line icons with an arrow between them (voice →
  clone, mic → profile, card with a strike = "no payment"), and a check mark
  that pops when done.
- **Screenshots as proof:** the official page, with the key sentence
  **highlighted** in the accent colour, and a slow scroll or a zoom to the line.
- **Status pills** at the top ("Building solo", "Application · 2:00 min"),
  like a phone notification. They carry context without a caption.
- **Numbers that count up** ("26,475 → 50,000+") and big standalone figures
  ("1 YEAR", "$1,000").
- **Series title cards** ("STOP PAYING — DAY 27"): big stacked type with a
  thin rule. They build a habit of returning viewers.
- **Social proof:** tweets or DMs from people who got the offer, stacked as
  cards.
- **Emphasis hits** (in the fast style): a coloured edge flash (red/green
  vignette), speed lines, an emoji sticker pop, a short meme reaction clip.
  Use at most one per 10 s.
- **3D app icons** (glossy rounded squares) when a brand or app is named.

## 7. The CTA end card

- **"Comment"** small above, **"WORD"** huge (in quotes or a box, in the accent
  colour or yellow), **"for the link" / "I'll DM you"** small below.
- It holds for 2–4 s over the speaker (full-frame or card) while they say it
  out loud.
- An optional last line: "Follow for more" or a "Follow" button pill.
- It's the only element that **bounces** in (scale 0.6 → 1.08 → 1).

**Zepply tie-in:** the keyword on the end card should be the same keyword as
a live Zepply comment→DM trigger, created automatically when the reel is made,
so every "Comment WORD" actually sends the link.

## 8. Templates to offer Zepply users

1. **"Free offer" reel** (businesses: discounts, freebies, giveaways):
   hook number → offer card → proof → 2–3 steps → urgency → Comment WORD.
2. **"Tool tip" reel** (creators: apps, hacks, how-tos): hook → series title
   card → icon explainer → screen walkthrough → Comment WORD.
3. **"My story" reel** (founders, personal brands): full-frame talking head
   with two-tier captions, layout moves into cards for numbers and proof,
   and a "follow along" CTA.

Each one is built on layout B with the creator's brand canvas, so a business
gets a consistent look from its first reel.

## 9. Checklist before export

- [ ] The claim, with its number, is on screen within the first second.
- [ ] Proof (a screenshot, highlight or tweet) appears before the steps.
- [ ] Something changes on screen every 2–4 s.
- [ ] One canvas colour, one type colour, one accent.
- [ ] Captions are 1–4 words, synced to the voice, in the language as spoken.
- [ ] The CTA keyword is one short word, the biggest type in the reel, and
      matches a live comment→DM trigger.
- [ ] Length 20–45 s unless the steps truly need more.
- [ ] Safe zones: nothing important in the top 120 px or the bottom 280 px
      (Instagram UI).
