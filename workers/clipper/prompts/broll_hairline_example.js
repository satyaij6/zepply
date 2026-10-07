// A worked Hairline moment, as the designer writes it (the body of the
// animation function). The html for it is:
//
//   <div id="m1-bg" style="position:absolute;inset:0;background:var(--hl-plate)"></div>
//   <div id="m1-fig" data-hairline style="position:absolute;left:40px;top:430px;width:1000px;height:800px">
//     <svg id="m1-svg" viewBox="0 0 400 320"></svg>
//   </div>
//   <div id="m1-word" class="word">LAYERS</div>
//
// Idea: a stack of four plates lifts apart, bottom first, and the top plate
// takes the bright stroke once it is clear -- "it's built in layers".
const { Cam, fit, proj, facing, rings, prism, solid, put, clamp } = HL;
const svg = el.querySelector("#m1-svg");

// Camera and fit: fit the MOST extreme pose (fully lifted) so nothing leaves the frame.
const C = Cam(45, 0.5, 1.9);
const LIFT = 26, THICK = 7, N = 4;
fit(C, [[0, 0, 0], [96, 96, 0], [0, 96, 0], [96, 0, 0], [48, 48, N * (THICK + LIFT)]], 200, 166);
const P = proj(C), front = facing(C);

// Build once, back to front. Same footprint, so bottom to top is back to front.
const [ring, inner] = rings(0, 0, 96, 96, 12, 2);
const plates = [];
for (let i = 0; i < N; i++) plates.push({ i, el: solid(svg) });

// All state the timeline moves. draw() is a pure function of it.
const st = { lift: 0, glow: 0 };
function draw() {
  for (const p of plates) {
    // Stagger by distance from the bottom plate: each starts a little later (rule 02).
    const k = clamp(st.lift * 1.6 - p.i * 0.2, 0, 1);
    const z0 = p.i * THICK + p.i * LIFT * k;
    put(p.el, prism(P, front, ring, inner, z0, z0 + THICK));
    p.el.sil.classList.toggle("hi", p.i === N - 1 && st.glow > 0.5); // one bright place (rule 04)
  }
}
draw();

const fig = el.querySelector("#m1-fig"), word = el.querySelector("#m1-word");
tl.fromTo(fig, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, T);
tl.to(st, { lift: 1, duration: 1.6, ease: "expo.out", onUpdate: draw }, T + 0.35);
tl.to(st, { glow: 1, duration: 0.01, onUpdate: draw }, T + 1.4);
tl.fromTo(word, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, T + 1.5);
// A slow drift while held, so nothing sits dead.
tl.fromTo(fig, { scale: 1 }, { scale: 1.04, duration: D - 0.6, ease: "none" }, T + 0.5);
tl.to([fig, word], { opacity: 0, duration: 0.25, ease: "power2.in" }, T + D - 0.25);
