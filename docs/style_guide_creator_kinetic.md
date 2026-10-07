# Style guide: "Creator Kinetic"

A reusable editing template for Zepply videos, measured from a reference
creator video (a 63.7 s, 3840×2160, 23.976 fps talking-head launch posted on X
by @Akshay_MehtaAM, studied frame by frame at 0.5 s and 0.1 s intervals). The
reference lives in `refs/` (git-ignored; it isn't ours to redistribute). We
take its **grammar**, not its words, product, logos or footage.

**This is the template closest to what Zepply makes.** It is a person talking
to camera, where the captions *are* the motion design: words are placed in the
space around the speaker's head, the key word is huge and sits **behind** the
head, and hand-drawn blue marks, highlight boxes and short graphic cutaways
explain the idea.

Siblings: [Clean Product Explainer](style_guide.md) (light, data) and
[Signal Grid](style_guide_signal_grid.md) (dark, process). This one sits on
top of the speaker's own footage.

---

## 1. Palette

Measured from the frames (sampled pixels, ±6 per channel from video compression).

| Role | Hex | Where |
|---|---|---|
| Accent blue | `#3888F0` | Every annotation: highlight boxes, scribbles, underlines, circles, arrows, counters, pills. |
| Accent blue (fills) | `#3084F6`–`#3C8AF6` | Full-frame wipes, big blue title fields. |
| Caption white | `#FFFFFF` | Words over footage. No stroke and no box: shadow-free, relying on the footage being dark. |
| Cream | `#FCF6F0` | Background of the explainer cutaways (collages, app screens, networks). Warm, never white. |
| Ink on cream | `#1E1E1E` (approx.) | Text and big numbers on cream cards. |
| Black | `#000000` | "Concept" cutaways (a key word alone on black). |
| Footage: warm walls | `#42301E` / `#3C2A1E` | The set: amber wood slats, practical lamps. |
| Footage: shadows | `#0C0C18` | Cool, slightly blue blacks in clothing and shadows. |

Rules:
- **One accent, used as a pen.** Blue is never a background for text on
  footage. It is the marker the editor "draws" with: boxes, strokes, circles.
  Full blue fields appear only as transitions or for the product name.
- **The footage is graded warm, with cool shadows** (amber walls, blue-black
  shadows), so white type and blue marks pop off it without outlines.
- **Three backgrounds for cutaways, each with a job:** cream = "here's how it
  works", black = "this one word matters", blue = "chapter change / the brand".

For Zepply users: the Brand Kit accent replaces the blue. It should be a
saturated mid-tone that reads on both the dark footage and the cream.

## 2. Type

| Use | Family (as observed) | Weight | Size (ref 1080p → 9:16 reel) | Tracking |
|---|---|---|---|---|
| Hero word (behind the head) | Neo-grotesk (Helvetica/Inter-Display-like) | Medium 500–600 | ~225 px (≈21% of frame height) → **180–240 px** | −3% |
| Connecting words ("is the", "of") | Same | Regular 400 | ~95 px → **72–88 px** | −1% |
| Emphasis line ("co-create", "Download") | Same | Semibold 600 | ~140 px → 130–160 px | −2% |
| Bracket captions `{ … }` | Same | Regular 400 | ~48 px → 48–56 px | 0 |
| Small labels (pills, "views", "Posted to") | Same | Medium 500 | ~28 px → 32–36 px | 0 |
| Big counters on cream | Same | Medium 500 | ~260 px → 220–280 px | −3% |
| Letter tiles ("c r e a t i v i t y") | Rounded sans | Medium 500 | one letter per tile, ~110 px → 96–110 px | n/a |

Rules:
- **One family.** Hierarchy comes from size (a 3:1 jump between the hero word
  and the connecting words) and from placement, not from many weights.
- **Lowercase, sentence-like.** Words appear as the speaker says them, so the
  screen reads like speech, not headlines.
- **No outlines, no boxes, no drop shadows** on caption words over footage.
  Legibility comes from the grade and the placement.
- Free stand-ins: **Inter** / **Inter Display** (OFL; Inter is already in
  `workers/clipper/assets/broll/fonts`) or **Geist** (OFL). Telugu and
  Devanagari: **Noto Sans Telugu / Devanagari** at the same sizes; the
  layout rules work for any script.

## 3. Shot length and structure

17 hard cuts in 63.7 s, found by scene detection (threshold 0.2):

| Shot | Time | Length | What |
|---|---|---|---|
| 1 | 0.0–2.5 | 2.5 s | Speaker, front: a struck-through hook word behind the head |
| 2 | 2.5–5.2 | 2.7 s | Speaker, slight push: words build in, the key word gets a blue box |
| 3 | 5.2–5.9 | 0.7 s | **Black cutaway:** the acronym circled, then warped into a sphere of itself |
| 4 | 5.9–13.6 | 7.7 s | Speaker, **second angle** (3/4 profile): a scribble sparkle, an underline, logos in a pill |
| 5 | 13.6–15.1 | 1.5 s | Speaker, front: a key word inside a blue box with braces |
| 6 | 15.1–16.5 | 1.4 s | **Cream cutaway:** a product-photo collage with sliding blue shapes |
| 7 | 16.5–17.0 | 0.5 s | **Cream cutaway:** a huge rolling counter |
| 8 | 17.0–18.6 | 1.6 s | **Cream cutaway:** a blue counter typing up, with image slots tumbling |
| 9 | 18.6–20.1 | 1.5 s | Speaker, close: bracket captions at the bottom |
| 10 | 20.1–22.1 | 2.0 s | **Black cutaway:** a key phrase with a blue underline |
| 11 | 22.1–24.4 | 2.3 s | Speaker, front: a bracket list growing word by word, with arrows |
| 12 | 24.4–30.3 | 5.9 s | **Cream cutaway:** concept word → app UI → product morphing |
| 13 | 30.3–31.6 | 1.3 s | Cream: "Introducing" + the product name in a blue field |
| 14 | 31.6–32.2 | 0.6 s | Blue zoom-through on the name |
| 15 | 32.2–44.5 | 12.3 s | **Explainer sequence:** a network of logos → avatars → blue wipe → ranking → list on a curved surface |
| 16 | 44.5–55.7 | 11.2 s | Speaker in a **virtual set**: a curved wall of product photos behind them, swapping by category |
| 17 | 55.7–59.9 | 4.2 s | Speaker, front: letter tiles, a scribble, the call to action in a blue box |
| 18 | 59.9–63.7 | 3.8 s | Cream end card: a bracket line building, an arrow, a logo |

- **Median shot ≈ 2 s.** The fast cutaways (0.5–1.5 s) are the beats; the long
  stretches (7–12 s) are the "explain it" sections, and within them graphics
  change every 1–2 s, so the eye never rests.
- **The A-roll has two angles** (front medium, and a closer 3/4 profile), and
  the cut lands on a new sentence or a punch word. Each angle is held 1.5–8 s.
- **Rhythm:** speaker → speaker → *cutaway* → speaker → *cutaway, cutaway,
  cutaway* → speaker → … → a long explainer → speaker + CTA → end card.

For Zepply clips: our clips are single-angle, so a **punch-in crop (~1.25×)**
stands in for the second angle (the reframe already knows where the face is).
Aim for one cutaway every 6–10 s, 0.5–2 s long.

## 4. Transitions

1. **Hard cut (most transitions).** On a sentence break or a punch word.
   Cutaways are hard cuts in and out too.
2. **Blue wipe with a soft, organic edge.** A full-frame blue field floods in
   from one corner with a blurred, liquid leading edge (~0.4 s), holds a short
   bracket line, then reveals the next scene the same way. It marks a chapter.
3. **Blur-through morph.** On cream cutaways, one element blurs heavily
   (~20 px) while it changes into the next (a word becomes an app screen; a
   product becomes its variant), then sharpens (~0.3 s each way).
4. **Zoom-through.** The product name scales up past the frame edges (~0.4 s,
   `power3.in`), filling the frame with blue for the next scene.
5. **Directional motion blur** on everything that moves fast (shapes sliding,
   image slots tumbling, counters rolling), so motion reads as speed, not
   jitter.

Never used: dissolves between talking-head shots, spins, glitches, page turns.

## 5. Camera moves

- **The A-roll is locked off.** It is two static angles, with a **slight digital
  push-in** on some shots (about 1.0 → 1.08 over the shot). No handheld.
- **Virtual set:** in one long section the speaker is cut out and placed in
  front of a **curved 3D wall** of image tiles. The wall rotates subtly and
  swaps its content by category (with a label pill at the top) while the
  speaker stays put.
- **Graphic-space moves:** a list on a curved cylinder rolls past; a word
  repeats into a 3D sphere; the logo network expands outward. These are the
  "camera moves" of the cutaways.
- **Perspective grids:** black cutaways carry a faint dashed grid that bends
  like a lens (barrel distortion), giving flat type a sense of space.

## 6. How text enters and exits

**Word-by-word, placed around the head.** Captions appear exactly as each
word is spoken, and they are **placed in the empty space around the speaker**:
left of the head, right of the head, above it. They are not stacked at the
bottom. Each word pops on in place (opacity 0 → 1 with a tiny scale 0.96 → 1,
~0.12 s), and lines grow as words arrive.

**The hero word goes behind the head.** One word per sentence (the noun or
verb that carries it) is set huge across the top of the frame, and the
speaker's head **occludes it**: it sits between the background and the person.
This needs a person cut-out (segmentation matte). It's the template's
signature.

**Highlight box:** a solid blue rectangle sweeps in **behind** a word, from left
to right (~0.2 s, `power2.out`), drawn with a thin selection outline and small
square corner handles, like a design tool's selected object. The handles
appear first (~0.1 s), then the fill.

**Hand-drawn marks** (blue, ~10 px stroke, round caps, drawn on with a
path reveal, ~0.25–0.4 s):
- a **strikethrough** swiped through a word that the sentence negates,
- a **circle** around an acronym or name,
- an **underline swoosh** under the phrase that matters,
- a **loop-de-loop line** that travels across the frame for a "flow" idea,
- a small **sparkle burst** (3 strokes) next to an exclamation.

**Bracket captions** `{ … }`: quieter lines appear inside curly braces that
**stretch outward** as each word is added. Thin arrows (← →) flash at the
sides when a list grows, and tiny square "pixels" blink at the corners.

**Letter tiles:** for a single key word, each letter drops in on its own blue
tile, slightly rotated (±8°), staggered ~0.04 s per letter.

**Counters:** big numbers roll with vertical motion blur (996M → 999M), or
type up digit by digit with a caret (1 → 1,000,000,000) over ~1.5 s.

**Exit:** words don't fade together. They **drop out letter by letter at
random** (each letter vanishes in ~0.05 s, the whole word over ~0.3 s), or the
shot simply cuts.

## 7. Textures and surfaces

- **Footage:** a warm, cinematic look with shallow depth of field and practical
  lamps in the background. Patterned light on the wall gives depth behind the
  speaker. The A-roll's texture *is* the set; there is no added grain.
- **Cream cutaways:** flat `#FCF6F0` with a very faint grid; photos with
  rounded corners (16–24 px); soft UI chrome (input bars, pills).
- **Black cutaways:** a faint dashed perspective grid only.
- **Geometric blue shapes** (plain rectangles in two blues) slide over
  collages with motion blur, a graphic counterpoint to the photos.
- **An iridescent orb** (a blue–violet gradient sphere) is the one glossy
  element, used for "AI" and the product.
- **Motion blur** on fast moves, and nowhere else.

## 8. Motion constants (copy into compositions)

```css
:root {
  --accent: #3888F0; --accent-fill: #3C8AF6; --cream: #FCF6F0; --ink: #1E1E1E;
  --black: #000000; --caption: #FFFFFF;
  --stroke: 10px;              /* hand-drawn marks at 1080 wide */
  --radius-photo: 20px;
}
```

```js
// GSAP, on the single paused timeline. Times relative to the spoken word's start.
const WORD     = { from: { opacity: 0, scale: 0.96 }, to: { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" } };
const HERO     = { from: { opacity: 0, yPercent: 8 }, to: { opacity: 1, yPercent: 0, duration: 0.25, ease: "power3.out" } };
const BOX      = { handles: 0.1, fill: { from: { scaleX: 0, transformOrigin: "0% 50%" }, to: { scaleX: 1, duration: 0.2, ease: "power2.out" } } };
const DRAW     = { duration: 0.32, ease: "power2.inOut" };   // strokeDashoffset L -> 0 for scribbles
const BRACES   = { duration: 0.18, ease: "power2.out" };     // braces slide outward as words are added
const TILE     = { from: { y: -40, rotation: () => gsap.utils.random(-8, 8), opacity: 0 }, stagger: 0.04, duration: 0.22, ease: "back.out(1.6)" };
const LETTER_OUT = { opacity: 0, duration: 0.05, stagger: { each: 0.03, from: "random" } };
const WIPE     = { duration: 0.4, ease: "power2.inOut" };    // blue field with a blurred edge
const BLUR_MORPH = { filter: "blur(20px)", duration: 0.3 };
const PUSH_IN  = { scale: 1.08, ease: "none" };             // over the whole shot
// Use a seeded random for TILE rotations in renders (no Math.random).
```

## 9. Adapting to 9:16 (Zepply reels)

Most of the template carries over directly, since our clips already *are*
talking heads.

- **Placement around the head:** in a 9:16 crop the free space is **above**
  the head (y 150–520) and at the sides of the shoulders. Hero words go across
  the top, behind the head; connecting words go left and right at eye or chin
  height (x 64–300 and 780–1016). We know where the face is from the reframe,
  so placement can be computed per frame.
- **Text behind the head** needs a person matte. Candidates: HyperFrames
  `remove-background`, or a selfie-segmentation model run once per clip on
  the proxy. Without a matte, place the hero word fully above the head instead.
- **Bracket captions replace our bottom captions** in this style: `{ … }` lines
  at y ≈ 1500–1700, 48–56 px, so the whole reel shares one typographic system.
- **Second angle:** alternate the reframe crop with a 1.25× punch-in on
  sentence breaks.
- **Cutaways** (cream / black / blue) run full-frame for 0.5–2 s, then cut back.

## 10. Checklist before export

- [ ] Words appear on the spoken syllable, placed around the head, never in a
      box or with an outline.
- [ ] At most one hero word per sentence, huge, ideally behind the head.
- [ ] Exactly one accent colour, used as a pen (boxes, strokes, circles).
- [ ] Each hand-drawn mark has a reason (negation = strike, name = circle,
      key phrase = underline).
- [ ] Cutaways use cream for "how", black for "the word", blue for "chapter".
- [ ] Median shot about 2 s; no talking-head shot runs past about 8 s without a
      new graphic or angle.
- [ ] Hard cuts between speaker shots; motion blur only on fast moves.
- [ ] Words exit letter by letter or on the cut, not by a slow fade.
- [ ] For 9:16: hero words in y 150–520; bracket captions in y 1500–1700.
