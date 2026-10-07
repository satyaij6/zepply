# Style guide: "Clean Product Explainer"

A reusable editing template for Zepply videos, measured from a reference launch
video (a 40 s, 1920×1080, 30 fps product explainer posted on X by
@jasonzhou1993, studied frame by frame at 0.5 s and 0.1 s intervals). The
reference lives in `refs/` (git-ignored; it isn't ours to redistribute). We
take its **grammar**, not its content, logos or brand.

Use it for: product launches, "us vs them" comparisons, feature tours, stats
and results, and story visuals (B-roll) on podcast clips that discuss numbers,
tools or processes. It is light, calm and data-forward, the opposite of
Zepply's dark editorial B-roll look, so offer both.

Other templates: [Signal Grid](style_guide_signal_grid.md), dark and
cinematic, for processes, workflows and "behind the scenes";
[Creator Kinetic](style_guide_creator_kinetic.md), kinetic captions and blue
pen marks on a talking head (closest to Zepply's clips).

---

## 1. Palette

Measured from the frames (sampled pixels, ±4 per channel from video compression).

| Role | Hex | Where it appears |
|---|---|---|
| Background | `#F0F6F6` | Every scene: a cool off-white with a faint mint tint. Never pure white. |
| Card / panel | `#FCFCFC` | Cards, tables, the end-card bar's surround: one step lighter than the background. |
| Ink (primary text) | `#181E1E` | Headlines, labels. Green-black, never `#000`. |
| Accent green | `#108860` | The one emphasis colour: the key word of each headline, winning bars, winning numbers, outlines, badges. |
| Mint glow | `#A0D0C0` | Burst rays, the halo behind a winner. |
| Light mint | `#D8F0E4` | The "good" half of a split screen; tints. |
| Blush | `#F6DED8` | The "other side" half of a split screen. Only used against mint. |
| Bar track | `#E4F0E4` | Empty bar backgrounds. |
| Loser fill | `#C0CCC0` | Bars and numbers that aren't the hero: desaturated grey-green. |
| Terminal | `#1E241E` / `#0C0C06` | Command bars and prompts. |

Rules:
- **One accent.** Green carries every "this is the point" moment. Everything
  else is ink or grey-green. A second hue (blush) appears only in a
  side-by-side comparison, and only as a big flat field.
- **The accent marks words, not lines.** In "**85%** cheaper than X.", only
  "85%" is green. In "Find **buying signals**", the object is green and the
  verb stays ink.
- **Dimming is the second accent.** When something wins, everything else drops
  to about 25–35% opacity rather than changing colour.

For Zepply users: swap `#108860` for the Brand Kit accent and keep everything
else. The rest of the palette is neutral enough for any brand colour that has
contrast on `#F0F6F6`.

## 2. Type

| Use | Family (as observed) | Weight | Size (ref 1080p → 9:16 reel) | Tracking |
|---|---|---|---|---|
| Headline | Monospaced slab with **deliberately pixel-stepped edges** (a bitmap-rendered mono) | Regular 400 | ~64 px → **88–104 px** | 0 (mono spacing does the work) |
| Second headline line | Same mono, in accent green | 400 | same as line 1 | 0 |
| Numbers in data | Same mono, tabular | 400 | ~44 px → 56–64 px | 0 |
| Labels, names, UI text | Neutral neo-grotesk sans (Inter-like) | 400–500 | ~30 px → 36–40 px | −0.5% |
| Micro captions (sources, footnotes) | Same sans | 400 | ~12 px → 20–22 px, ~45% opacity | +1% |
| Terminal text | Same mono | 400 | ~22 px → 30–32 px | 0 |

Rules:
- **Two families only:** a mono for voice and numbers, a sans for interface.
- **Always regular weight.** Emphasis comes from colour (green), never bold.
- **Sentence case with a full stop.** "Most accurate." "One key." The period
  makes a headline read as a statement, not a label.
- **Centred when alone, top-centred when content arrives** (see §6).
- Free stand-ins we can ship: **Departure Mono** (OFL, pixel mono) for the
  headline look, or **JetBrains Mono** / **Geist Mono** (OFL) for a cleaner
  mono; **Inter** (already in `workers/clipper/assets/broll/fonts`) for labels.
  Telugu and Devanagari lines fall back to **Noto Sans Telugu / Devanagari**
  at 0.9× size, since no mono covers those scripts well.

## 3. Shot length and structure

There are **no hard cuts**: no scene-change score passed 0.2. The video is
one continuous motion-graphics flow in which each beat rebuilds the frame in
place.

| Beat | Time | Length |
|---|---|---|
| Title ("Introducing …") | 0.0–2.9 s | 2.9 s |
| Split-screen versus | 2.9–5.6 s | 2.7 s |
| Stat 1 + bar chart + winner | 5.6–9.0 s | 3.4 s |
| Stat 2 + bar chart + winner | 9.0–12.1 s | 3.1 s |
| Stat 3 + side-by-side race + winner | 12.1–15.6 s | 3.5 s |
| Bridge line ("One key. …") | 15.6–17.0 s | 1.4 s |
| Feature 1–5 (one headline + one UI card each) | 17.0–29.0 s | 2.1–2.6 s each |
| Product demo (terminal + live table) | 29.0–35.7 s | 6.7 s |
| End card (logo, one-liner, install bar) | 35.7–40.1 s | 4.4 s |

- **Median beat ≈ 2.7 s**; nothing over 7 s. Features run fastest (~2.3 s);
  the payoff demo gets the most time.
- **Within a stat beat:** the headline holds alone for ~0.5 s → the content
  builds for ~1.2 s → the winner moment lands → ~0.8 s hold.
- **Arc:** claim → contrast → three proofs → bridge → feature rapid-fire →
  demo → call to action.

For podcast clips (story visuals), use the same rhythm: a visual moment of
2.5–3.5 s, the headline alone for the first 0.5 s, and the payoff on the
spoken word.

## 4. Transitions

In order of how often they appear:

1. **Rebuild in place (most transitions).** The background never changes. The
   old content fades and blurs out (~0.25 s) while the new headline blurs in at
   the same spot. Nothing slides across the frame.
2. **Headline lift.** A headline that started centred travels up to the top
   and scales to about 0.85× (~0.4 s, ease-out) to make room for the content
   building underneath it. This is the video's main "camera" move.
3. **Pixel-mosaic dissolve.** The frame breaks into large square blocks (about
   40–60 px at 1080p) and re-forms as the next scene in ~0.2 s. Used once, into
   the versus screen: it reads as digital and decisive.
4. **Glitch + zoom-through.** "VS" gets an RGB split and stepped jitter, then
   scales up to fill the frame and pixel-dissolves into the next beat (~0.3 s).
5. **Fade to background.** Between major sections, everything fades into
   `#F0F6F6` over ~0.3 s, and the next headline fades and blurs up out of it.
6. **Diagonal split wipe.** The versus screen is two angled panels (about 10°
   off vertical) in blush and mint. A jagged "crack" line runs down the seam
   when the two sides collide.

Never used: whip pans, spins, page curls, star wipes, or a cut to black.

## 5. Camera moves

- **There is no real camera.** The frame stays put. Motion comes from elements
  moving inside it.
- **Implied push:** the headline lift (§4.2) and the winner row scaling up to
  ~1.05× do the work a push-in would.
- **Fly-ins:** logo tiles enter from off-frame, rotated about 15–25°, and
  settle with a small overshoot (~0.5 s).
- **Zoom-through** on "VS" only (§4.4).
- For 9:16 reels, also allow a slow **drift** (scale 1.00 → 1.03 over a long
  hold), so nothing sits dead on a phone.

## 6. How text enters and exits

**Enter (default):** opacity 0 → 1 **and** blur 8 px → 0 **and** colour
grey → ink, over 0.25–0.3 s with an ease-out. The text appears to come into
focus where it will sit; it does not slide in. A faint ghost is visible for
one or two frames, which is the signature look.

**Second line:** enters as its own beat, 0.4–0.6 s after the first, with the
same blur-in. "One key." → "Every enrichment job." (accent green).

**Typewriter:** only for terminal and command text, at ~15 characters per
second, with a solid block caret that keeps blinking after the line is done.

**Numbers:** count up from 0 together with their bar growing (~1.2 s,
`power2.out`), in tabular mono so the digits don't jitter.

**Emphasis stamp ("WINNER"):** a green tag rotated about −8°, which slams in from
1.6× scale to 1.0 in ~0.2 s (`back.out`). At the same time the winning row
gets a 2 px green outline and a 1.05× scale, every other row dims to ~30%, a
radial burst of mint rays fades in behind it, and a short confetti scatter
(about 20–30 small specks in green, lime and ink) plays for ~0.8 s.

**Exit:** blur 0 → 6 px and opacity 1 → 0 over ~0.2 s, or the whole scene
fades into the background (§4.5). Text never flies out.

## 7. Textures and surfaces

- **No film grain, no noise, no vignette.** It is a clean digital surface.
- **Soft cards:** `#FCFCFC` panels with 12–16 px corner radius and a very soft
  shadow (y 8–16 px, blur 32–40 px, ~6% ink).
- **Pinstripes:** the split-screen fields carry faint diagonal stripes (about
  3–4% darker than the field).
- **Glow** only behind a winner: the mint burst plus a soft outer glow on the
  outlined row.
- **Highlighter marks:** the quoted social cards get a soft yellow highlight
  behind the key phrase, like a marker pen.
- **Icons:** product logos sit in rounded white tiles (the "app icon" look).
  There are no line icons or icons in coloured squares.

## 8. Motion constants (copy into compositions)

```css
:root {
  --bg: #F0F6F6; --card: #FCFCFC; --ink: #181E1E; --accent: #108860;
  --glow: #A0D0C0; --mint: #D8F0E4; --blush: #F6DED8;
  --track: #E4F0E4; --loser: #C0CCC0; --term: #1E241E;
  --radius: 14px; --shadow: 0 12px 36px rgba(24, 30, 30, 0.06);
}
```

```js
// GSAP, on the single paused timeline
const ENTER = { from: { opacity: 0, filter: "blur(8px)", color: "#9AA3A0" },
                to:   { opacity: 1, filter: "blur(0px)", color: "var(--ink)", duration: 0.28, ease: "power2.out" } };
const EXIT  = { opacity: 0, filter: "blur(6px)", duration: 0.2, ease: "power1.in" };
const LIFT  = { y: -560, scale: 0.85, duration: 0.4, ease: "power3.out" };   // 9:16: centre → top band
const BAR   = { duration: 1.2, ease: "power2.out" };                           // with a count-up onUpdate
const STAMP = { from: { scale: 1.6, rotation: -8, opacity: 0 },
                to:   { scale: 1, rotation: -8, opacity: 1, duration: 0.2, ease: "back.out(2)" } };
const STAGGER = 0.1;  // rows, cards, pins
```

The grey `#9AA3A0` used for the enter "ghost" is approximate: it appears for
only a frame or two.

## 9. Adapting to 9:16 (Zepply reels)

- The headline sits at **y ≈ 300–420** once lifted (it starts centred at
  y ≈ 860). Content occupies **y ≈ 480–1380**.
- Keep **y 1440–1760 clear** for burned captions, and 64 px side margins.
- Comparisons stack **top/bottom** instead of left/right: blush on top, mint
  below, with the crack running horizontally.
- Bar charts: at most 5 rows, labels left, numbers right in mono, and a 28–32 px
  bar height.
- Phones are read at arm's length, so scale everything up about 1.35× from
  the 1080p reference (the sizes in §2 already include that).

## 10. Checklist before export

- [ ] Background is `#F0F6F6` everywhere; nothing is pure white or pure black.
- [ ] Each headline has exactly one green word or phrase.
- [ ] Every beat is 1.4–3.5 s, apart from one demo beat (≤ 7 s).
- [ ] Text enters by blur-in at its final position; nothing slides in.
- [ ] One winner moment per proof: stamp, outline, dim the rest, burst.
- [ ] No grain, no vignette, no hard cut to black.
- [ ] Numbers are tabular mono and count up with their bars.
- [ ] Captions band (y 1440–1760) is clear.
