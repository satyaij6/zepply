# Style guide: "Signal Grid"

A reusable editing template for Zepply videos, measured from a reference
launch video (a 74.5 s, 2560×1440, 30 fps developer-tool film posted on X by
@skull8888888888, studied frame by frame at 0.5 s and 0.1 s intervals). The
reference lives in `refs/` (git-ignored; it isn't ours to redistribute). We
take its **grammar**, not its content, logos or product.

Its look: a dark blueprint world where a process is drawn as a **chain of
colour-coded step blocks** that travels like a train, and a camera that follows
it, pushes in for detail and pulls back to show scale, with **halftone
clouds** as the one organic texture.

Use it for: explaining a process or workflow (how an order is handled, a
creator's posting routine, a pipeline), "what happens behind the scenes",
anything with steps, failures and fixes, and tech or AI topics. It is the
companion to [style_guide.md](style_guide.md) ("Clean Product Explainer",
light) and [Creator Kinetic](style_guide_creator_kinetic.md) (on a talking
head): this one is dark, cinematic and built on systems.

---

## 1. Palette

Measured from the frames (sampled pixels, ±6 per channel from video compression).

**World**

| Role | Hex | Where |
|---|---|---|
| Background | `#181818` | Every scene. Neutral near-black, not blue-black. |
| Grid lines | `#242424` | 1 px blueprint grid over everything. |
| Grid dots | `#4A4A4A` (approx.) | One dot at the centre of each cell. |
| Text / white | `#FCFCFC` | Titles, the step chain's "head", pop-up cards. |
| Body text | `#9A9A9A` (approx.) | Mono paragraphs under the blocks. |
| Muted blocks | `#5A5A5A` / `#484848` | The same chains drained of colour, as "many runs" in the background. |
| Clouds | `#3C3C3C`–`#6A6A6A` | Halftone cloud texture, greys only. |

**Step colours** (each kind of step always has the same colour)

| Step kind | Hex | Notes |
|---|---|---|
| Thinking / main action | `#4A86DC` | Range `#3C82E6`–`#5A8CD2` across its gradient |
| Read / input | `#E68C5F` | Warm orange |
| Write / output | `#2AAA6A` | Range `#1EAA64`–`#50B482` |
| Tool / joint | `#F0DC0A` | Square connectors with a hexagon icon, between steps |
| Message / talk | `#A082F0` | Purple squares with a speech-bubble icon |
| Variant thinking | `#F08282` | Coral |
| Run / command | `#F0A0D2` | Pink (the reference's "Bash") |
| **Hero highlight** | `#82B4FA` | Light blue, only for *the* thing being sold: its bar, its tile, its dots |
| Error highlight | `#F06464` (approx.) | Red marker behind the words that are wrong, and warning badges |
| Cost meter | `#F0C814` → `#F0A040` | Yellow-to-orange bar that shrinks |

Rules:
- **Colour means a kind of thing, every time.** A viewer learns in seconds
  that blue means thinking and green means writing, and the chain becomes
  readable at a glance. Never pick colours for decoration.
- **Grey means "the rest".** When the camera pulls back to show scale, other
  chains go grey (`#5A5A5A`), so the one in colour is the story.
- **One hero colour** (`#82B4FA`) is reserved for the product or answer. It
  appears only late in the film.

For Zepply users: keep the world greys, map the step colours to the steps of
*their* process, and use the Brand Kit accent as the hero colour.

## 2. Type

| Use | Family (as observed) | Weight | Size (ref 1440p → 9:16 reel) | Tracking |
|---|---|---|---|---|
| Step labels ("Thinking", "Read") | Monospace (JetBrains-Mono-like) | Regular 400 | ~36 px → **40–44 px** | 0 |
| Hero title (the product name) | Same mono, very large | 400 | ~160 px → **140–170 px** | −1% |
| Section titles ("… intelligence") | Same mono, two lines | 400 | ~44 px → 52–60 px | 0 |
| Body under blocks, terminal logs | Same mono | 400 | ~20 px → 26–30 px | 0 |
| Chart labels, numbers | Same mono | 400 | ~18 px → 24–28 px | 0 |
| Brand sign-off | Geometric sans (logo only) | 600 | ~40 px → 56 px | 0 |

Rules:
- **One monospace runs the whole film.** It says "system", lines labels up
  with code, and keeps columns of numbers aligned. The sans appears only in
  the closing logo.
- **Lowercase-friendly and quiet.** Titles are not bold and not uppercase; size
  and space carry them.
- **Text on a coloured block is dark** (`#181818` at ~85%); text on the world
  is white or grey.
- Free stand-ins: **JetBrains Mono** (OFL), or **Geist Mono** / **Commit Mono**
  (OFL). Telugu and Devanagari lines use **Noto Sans Telugu / Devanagari** at
  0.9×, since no mono covers them.

## 3. Shot length and structure

There are **no hard cuts**: no scene-change score passed 0.15. The film is one
continuous camera through one world, and beats change by camera moves.

| Beat | Time | Length |
|---|---|---|
| Spark: a white ring appears, a "Thinking" pill grows out of it, clouds puff | 0.0–2.0 s | 2.0 s |
| Follow: the chain streams through the ring as the camera tracks it | 2.0–7.2 s | 5.2 s |
| Turn: the chain bends 90° upward; the camera follows | 7.2–8.8 s | 1.6 s |
| Detail: blocks lift into cards with text; an error is marked | 8.8–12.9 s | 4.1 s |
| Pull back: the chain shrinks into one cell of a huge dot grid | 12.9–14.5 s | 1.6 s |
| Cloud pass (transition) | 14.5–17.8 s | 3.3 s |
| Scale: many grey chains run in lanes | 17.8–22.3 s | 4.5 s |
| Push in: a terminal log of one failing step | 22.3–25.3 s | 3.0 s |
| Cost meter shrinking over the chain | 25.3–28.8 s | 3.5 s |
| Hero title rises with clouds | 28.8–32.3 s | 3.5 s |
| Benchmark bars (hero bar in light blue) | 32.3–37.5 s | 5.2 s |
| Dot-matrix comparison (few dots vs a field) | 37.5–40.6 s | 3.1 s |
| Product mark assembles from shapes | 40.6–44.0 s | 3.4 s |
| Case: one chain → error → classification card | 44.0–53.0 s | 9.0 s |
| Pull back to a grid of colour-coded warnings, clustering | 53.0–59.7 s | 6.7 s |
| Command card types the fix | 59.7–63.0 s | 3.3 s |
| Final pull back to a dense field | 63.0–67.0 s | 4.0 s |
| Logo, then URL | 67.0–74.5 s | 7.5 s |

- **Median beat ≈ 3.5 s** (slower than the light template's 2.7 s, since a
  moving camera needs time to read). The longest is 9 s, the one full case.
- **Arc:** a single run up close → its failure → the scale of the problem →
  the product → proof → a real case → the scale again, now solved → sign-off.
- **Rhythm:** close, close, *pull back*, close, close, *pull back*. Each
  pull-back resets the eye and ends a chapter.

For podcast clips (story visuals), use 3–5 s moments, and save the pull-back
for the moment the speaker says "and this happens everywhere" (scale).

## 4. Transitions

1. **Camera carries the cut (most transitions).** The next beat is already in
   the world; the camera tracks, pans or zooms to it. Nothing fades to black.
2. **Pull back into a grid cell.** The current scene scales down (to ~8% over
   ~1.5 s, `power2.inOut`) until it's one cell of a dot grid that fills the
   frame. It means "this is one of many".
3. **Halftone cloud pass.** Grey dithered clouds rise from the bottom, fill the
   frame for ~1 s and drift off, revealing the next scene (3 s in all). Used
   twice, at the two biggest chapter changes.
4. **Colour drain.** When a single chain becomes "many chains", colour fades to
   grey (~0.5 s) as the camera pulls back.
5. **Shape morph.** The ring at the head of the chain becomes the next element
   (a big blue disc, then back into the head of a new chain). One object
   carries continuity across beats.
6. **Assemble.** The product mark builds from geometric parts (semicircles, a
   square tile, a ring, a hatched bar) sliding in, then the tile fills with
   the hero blue.

Never used: crossfades between unrelated images, wipes with edges, glitch,
whip pans.

## 5. Camera moves

- **Tracking:** the chain's head stays fixed at about 60% of frame width, and
  the world scrolls past it at a constant speed (one block, ~180 px at 1440p,
  every ~0.4 s). Calm and continuous.
- **Follow a turn:** when the chain bends upward, the camera pans up with it
  (~0.6 s, ease-in-out).
- **Push-in:** to read a card or a log, the camera scales the world up about
  2–3× around the detail (~0.8 s, `power3.inOut`).
- **Pull-back:** see §4.2. Always ease-in-out, never linear.
- **Parallax:** clouds move at about 0.4× the foreground speed, distant grey
  lanes at 0.6×, and near ones at 1×. That depth is what makes the flat graphics
  feel like a world.
- **No rotation, no shake, no handheld.**

## 6. How text enters and exits

**Step labels:** the block grows out of the head (width from 0, left to right,
~0.25 s) and the label is revealed by the block's own edge (a mask), so the
label never fades.

**Card text:** blocks lift up into cards; their body text appears line by line
(~0.08 s apart), each line a short opacity 0 → 1 with no movement.

**Error marking:** the wrong words get a red marker drawn behind them, left to
right (~0.3 s), then a warning badge pops (scale 0 → 1.15 → 1, ~0.25 s,
`back.out`).

**Pop-up card:** a white rounded blob with a speech-tail scales up from about
0.4× (~0.3 s), then its rows fade in with a ~0.1 s stagger. Tags such as
true / false / critical appear as coloured pills.

**Titles:** the hero title rises from below the frame with the clouds (y +40%
→ 0 over ~0.7 s, `power3.out`). It leaves the same way: the camera moves up and
the title slides out at the top, and it is never faded out.

**Typewriter:** command text types at ~25 characters per second inside a dark
card. A chip inside the command (a highlighted token) appears as a pill once
it's typed.

**Numbers:** benchmark bars grow from 0 (~0.8 s, `power2.out`) with their value
labels already in place, all in mono. The hero bar is the only one in light
blue.

**Exit rule:** things leave by being left behind (camera moves, pull-backs,
clouds), not by fading in place.

## 7. Textures and surfaces

- **Blueprint grid:** 1 px `#242424` lines, cells about 1/13 of frame width,
  and a `#4A4A4A` dot at each cell centre. It is on every frame, and it is
  what moves when the camera moves.
- **Halftone clouds:** dithered grey cumulus clouds made of a fine dot screen.
  This is the one organic, analogue element, and it is used for openings,
  transitions and the hero title. Keep it monochrome.
- **Block gradients:** every coloured block runs from ~12% lighter on the left
  to full colour on the right, which makes the chain look lit and in motion.
- **Square corners on blocks;** soft rounded corners (~16 px) only on white
  cards and pills.
- **Icons:** simple line icons (a hexagon and a ring, a speech bubble, a
  warning triangle) in dark ink on coloured squares.
- **No grain, no glow, no bloom, no vignette.** The halftone is the texture.

## 8. Motion constants (copy into compositions)

```css
:root {
  --world: #181818; --grid: #242424; --dot: #4A4A4A; --ink: #FCFCFC; --body: #9A9A9A;
  --muted: #5A5A5A;
  --step-think: #4A86DC; --step-read: #E68C5F; --step-write: #2AAA6A;
  --step-tool: #F0DC0A; --step-talk: #A082F0; --step-alt: #F08282; --step-run: #F0A0D2;
  --hero: #82B4FA; --error: #F06464;
  --cell: 154px;            /* 9:16: 1080 / 7 */
}
.step { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 88%, white), var(--c)); }
```

```js
// GSAP, on the single paused timeline
const TRACK   = { pxPerSec: 450 };                                  // world scroll speed at 1080 wide
const GROW    = { from: { width: 0 }, duration: 0.25, ease: "power2.out" };   // step block out of the head
const PUSH_IN = { scale: 2.5, duration: 0.8, ease: "power3.inOut" };
const PULL    = { scale: 0.08, duration: 1.5, ease: "power2.inOut" };         // into one grid cell
const DRAIN   = { filter: "saturate(0)", duration: 0.5, ease: "power1.inOut" };
const LINE    = { from: { opacity: 0 }, to: { opacity: 1, duration: 0.15 }, stagger: 0.08 };
const BADGE   = { from: { scale: 0 }, to: { scale: 1, duration: 0.25, ease: "back.out(2.5)" } };
const TITLE   = { from: { yPercent: 40, opacity: 0 }, to: { yPercent: 0, opacity: 1, duration: 0.7, ease: "power3.out" } };
const TYPE    = { cps: 25 };
const PARALLAX = { clouds: 0.4, far: 0.6, near: 1.0 };
```

## 9. Adapting to 9:16 (Zepply reels)

- **The chain runs vertically**, bottom to top, with the head at about
  y = 0.42 of the frame, or horizontally through the middle band (y 700–1000)
  with the head at x = 0.6. Turns become left/right bends.
- Grid cells of 154 px (seven across).
- Push-ins target the upper-middle band; keep **y 1440–1760 clear** for
  burned captions, and 64 px side margins.
- Hero titles sit at y ≈ 600–900 with clouds rising below them, above the
  captions.
- On a phone, labels at 40–44 px read at arm's length, and body text below
  26 px does not, so cut body text to two or three lines.

## 10. Checklist before export

- [ ] Background `#181818` with the grid and dots on every frame.
- [ ] Each step colour means one kind of step throughout.
- [ ] Only the hero uses `#82B4FA`; everything secondary goes grey.
- [ ] No hard cuts and no fades to black: the camera moves between beats.
- [ ] At least one pull-back, and it lands on a "this is one of many" idea.
- [ ] Clouds are halftone grey, move slower than the foreground, and appear
      at most at 2–3 key moments.
- [ ] One monospace for all text; the sans is used only for the logo.
- [ ] Things exit by being left behind, not by fading.
- [ ] Captions band (y 1440–1760) is clear.
