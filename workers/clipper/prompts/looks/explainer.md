## Look for this clip: Clean Explainer (light)

This replaces the dark default above. The full template is in
docs/style_guide.md; the parts that matter here:

- Background `#F0F6F6` (cool off-white), cards `#FCFCFC` with 14px radius and a
  very soft shadow, ink `#181E1E`, ONE accent (the brand accent; default
  `#108860`). Losing or secondary items are grey-green `#C0CCC0` and dim to
  ~30% opacity when something wins.
- No grain, no vignette, no glow except a soft halo behind a winner.
- Headlines are short statements with a full stop ("Most accurate."); exactly
  one word in the accent colour. A monospaced face suits numbers -- use
  "Inter Tight" with tabular figures if nothing else fits.
- Motion: text comes into focus where it sits (opacity + blur 8px -> 0 over
  ~0.28s), a headline that started centred lifts to the top (0.4s) as content
  builds beneath it, bars grow from 0 with their number counting up (~1.2s),
  a winner gets a tilted "stamp" tag that slams in, a 2px accent outline,
  and everything else dims. Exits blur out (~0.2s). Nothing slides across.
- Hairline figures in this look are drawn on the light palette already set
  up for you (plates are the background colour, strokes are dark grey, the
  accent edge is the brand accent).
