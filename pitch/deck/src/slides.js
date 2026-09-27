/* ================= Farm Hand deck: ShellHacks 2026 =================
   Built on the eWARP deck kit (DESIGN.md sections 10-19). Engine, fonts, nav: unchanged.
   Meaning colors for Farm Hand: blue = Farm Hand / the decision model / box A, gold = the timer / box B,
   orange = moving things (water flowing, data travelling), red = trouble, green = the plant. */

/* numbers in one place. "todo" values are drawn as dashed placeholders until the real number lands */
const FH = {
  pace: 0.8,
  names: ["Dechante Chang", "Matthew Losito", "Daniel Lopes"],
  site: "farmhand.dmchang.xyz",
  /* results slide: both boxes side by side. tag = the small label in the corner (edit or set to "") */
  results: {tag: "Demo run", hours: 15, timerL: 4.8, timerPours: 8, layaL: 0.8, layaDrinks: 2, floor: 45, soggyH: 11},
};
const RED = K.miss, GREEN = K.ok, BLUE = K.bt, GOLD = K.gold, ORANGE = K.live;
const SOIL = "#5a4431", SOIL_WET = "#1b130b";
const HALO = "paint-order:stroke;stroke:#0a0e13;stroke-width:8px;stroke-linejoin:round";

/* each slide block sets ID; ORDER at the bottom picks which slides show, and in what order */
let ID = "";
const _add = addSlide;
addSlide = (o) => { _add(o); SLIDES[SLIDES.length - 1].id = ID; };

/* small helpers on top of the kit */
const t = (x, y, str, style) => tx({x, y, style}, str);
function fadeTo(el, to, dur = 600) {
  const from = el.style.opacity === "" ? 1 : +el.style.opacity;
  el.style.opacity = to;
  play(el, [{opacity: from}, {opacity: to}], {duration: dur, easing: EASE});
}
function countTo(el, from, to, dur, fmt = (v) => `${Math.round(v)}%`) {
  const N = 18;
  for (let i = 1; i <= N; i++) at(dur * i / N, () => { el.textContent = fmt(from + (to - from) * i / N); });
}
function grow(el, axis, dur = 1200, origin) {
  el.style.transformOrigin = origin || (axis === "x" ? "0 50%" : "50% 100%");
  show(el, [{opacity: 1, transform: `scale${axis.toUpperCase()}(0)`}, {opacity: 1, transform: "none"}], dur);
}
function pill(cx, cy, label, color, w, fill = K.surface2, hh = 44, size = 19) {
  w = w || label.length * size * .52 + 44;
  return grp(s("rect", {x: cx - w / 2, y: cy - hh / 2, width: w, height: hh, rx: hh / 2, fill, stroke: color, "stroke-width": 2}),
    t(cx, cy + 1, label, `font:700 ${size}px var(--f-body);fill:#edf2f7;text-anchor:middle;dominant-baseline:central`));
}
function badge(cx, cy, label, owner, w) {
  const o = {us: [BLUE, "rgba(57,135,229,.16)"], vendor: [GOLD, "rgba(240,180,41,.13)"], bad: [RED, "rgba(229,83,75,.14)"]}[owner];
  return pill(cx, cy, label, o[0], w, o[1], 50, 21);
}
/* seeded random so the soil speckles are the same every time */
let SEED = 7;
const rnd = () => ((SEED = (SEED * 16807) % 2147483647) / 2147483647);

function sprout(x, base, k = 1, color = GREEN) {
  const p = (d) => s("path", {d, fill: color});
  return s("g", {}, s("path", {d: `M${x},${base} V${base - 26 * k}`, stroke: color, "stroke-width": 3 * k, "stroke-linecap": "round"}),
    p(`M${x},${base - 14 * k} c${-12 * k},0 ${-19 * k},${-8 * k} ${-19 * k},${-17 * k} c${11 * k},0 ${19 * k},${6 * k} ${19 * k},${17 * k} z`),
    p(`M${x},${base - 20 * k} c${12 * k},0 ${19 * k},${-8 * k} ${19 * k},${-16 * k} c${-11 * k},0 ${-19 * k},${6 * k} ${-19 * k},${16 * k} z`));
}

/* a clear storage tote of soil with a moisture probe, a temperature probe and a pump in a cup.
   Returns the pieces the slides animate: wet (soil darkening), tubeFlow + stream (water), drips (runoff). */
function tote(x, y, w, hh, o = {}) {
  const top = y + 12, bot = y + hh, ys = y + hh * (o.soilTop || .42), inset = 16;
  const xl = (yy) => x + inset * (yy - top) / (bot - top), xr = (yy) => x + w - inset * (yy - top) / (bot - top);
  const g = s("g", {});
  const body = s("path", {d: `M${x},${top} L${x + w},${top} L${x + w - inset},${bot} L${x + inset},${bot} Z`, fill: "rgba(237,242,247,.04)", stroke: "rgba(237,242,247,.4)", "stroke-width": 2, "stroke-linejoin": "round"});
  const soilD = `M${xl(ys) + 3},${ys} L${xr(ys) - 3},${ys} L${x + w - inset - 3},${bot - 3} L${x + inset + 3},${bot - 3} Z`;
  const soil = s("path", {d: soilD, fill: SOIL});
  const wet = s("path", {d: soilD, fill: SOIL_WET});
  wet.style.opacity = 0;
  const specks = s("g", {});
  for (let i = 0; i < Math.round(w * (bot - ys) / 520); i++) {
    const yy = ys + 6 + rnd() * (bot - ys - 12), xx = xl(yy) + 8 + rnd() * (xr(yy) - xl(yy) - 16);
    specks.append(s("circle", {cx: xx.toFixed(1), cy: yy.toFixed(1), r: (1 + rnd() * 1.8).toFixed(1), fill: rnd() > .5 ? "#735a42" : "#3b2c1f"}));
  }
  const rim = s("rect", {x: x - 8, y, width: w + 16, height: 13, rx: 6.5, fill: K.surface2, stroke: "rgba(237,242,247,.4)", "stroke-width": 1.6});
  const k = o.k || 1;
  const plants = s("g", {}, sprout(x + w * .42, ys + 2, 1.15 * k), sprout(x + w * .54, ys + 2, .85 * k));
  /* probes: flat capacitive blade + thin steel temperature rod */
  const px = x + w * .7, px2 = x + w * .84;
  const probe = s("g", {},
    s("rect", {x: px - 8 * k, y: ys - 46 * k, width: 16 * k, height: 100 * k, rx: 3, fill: "#1b2733", stroke: K.ink2, "stroke-width": 1.8}),
    s("rect", {x: px - 4 * k, y: ys - 40 * k, width: 8 * k, height: 12 * k, rx: 1.5, fill: K.axis}),
    s("path", {d: `M${px2},${ys - 40 * k} V${ys + 72 * k}`, stroke: "#9aa6b2", "stroke-width": 5 * k, "stroke-linecap": "round"}),
    s("rect", {x: px2 - 6 * k, y: ys - 52 * k, width: 12 * k, height: 16 * k, rx: 3, fill: K.surface2, stroke: K.ink2, "stroke-width": 1.6}));
  /* pump sits in a cup to the left; its tube climbs over the rim and drips in */
  const cx = x - 46 * k, cy = bot - 30 * k, nx = x + w * .2;
  const cup = s("g", {},
    s("path", {d: `M${cx - 22 * k},${cy - 26 * k} L${cx + 22 * k},${cy - 26 * k} L${cx + 17 * k},${cy + 26 * k} L${cx - 17 * k},${cy + 26 * k} Z`, fill: "rgba(237,242,247,.05)", stroke: "rgba(237,242,247,.45)", "stroke-width": 2, "stroke-linejoin": "round"}),
    s("path", {d: `M${cx - 20 * k},${cy - 12 * k} L${cx + 20 * k},${cy - 12 * k} L${cx + 17 * k},${cy + 24 * k} L${cx - 17 * k},${cy + 24 * k} Z`, fill: "rgba(217,89,38,.28)"}),
    s("rect", {x: cx - 9 * k, y: cy + 4 * k, width: 18 * k, height: 16 * k, rx: 3, fill: K.surface2, stroke: K.ink2, "stroke-width": 1.4}));
  const tubeD = `M${cx},${cy + 4 * k} V${y - 8} Q${cx},${y - 24} ${cx + 16},${y - 24} H${nx - 16} Q${nx},${y - 24} ${nx},${y - 8} V${y + 14}`;
  const tube = s("path", {d: tubeD, fill: "none", stroke: "#5b6874", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round"});
  const tubeFlow = s("path", {d: tubeD, fill: "none", stroke: ORANGE, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round"});
  const stream = s("path", {d: `M${nx},${y + 16} V${ys + 2}`, stroke: ORANGE, "stroke-width": 6 * k, "stroke-linecap": "round"});
  const splash = s("ellipse", {cx: nx, cy: ys + 2, rx: 26 * k, ry: 5 * k, fill: "rgba(217,89,38,.45)"});
  const drips = [0, 1, 2].map((i) => s("circle", {cx: x + w * (.3 + i * .2), cy: bot + 12, r: 5, fill: ORANGE}));
  [tubeFlow, stream, splash, ...drips].forEach((e) => e.style.opacity = 0);
  g.append(soil, wet, specks, plants, body, probe, rim, cup, tube, tubeFlow, stream, splash, ...drips);
  return {g, wet, tubeFlow, stream, splash, drips, ys, bot, px, px2, cx, cy, nx, probeTop: [px, ys - 46 * k], tempTop: [px2, ys - 52 * k],
    reset() { [wet, tubeFlow, stream, splash, ...drips].forEach((e) => e.style.opacity = 0); }};
}
/* the pump runs: water climbs the tube, falls into the soil, the soil darkens */
function pumpRun(T, wetTo = .6, dur = 700) {
  draw(T.tubeFlow, dur);
  at(dur, () => { draw(T.stream, 350); show(T.splash, FADE, 300); fadeTo(T.wet, wetTo, 1200); });
  at(dur + 1300, () => { [T.tubeFlow, T.stream, T.splash].forEach((e) => fadeTo(e, 0, 400)); });
}
/* water that the soil can't hold drips out the bottom */
function runoff(T, delay = 900) {
  T.drips.forEach((d, i) => at(delay + i * 180, () => {
    d.style.opacity = "";
    play(d, [{opacity: 0, transform: "translateY(-8px)"}, {opacity: 1, transform: "translateY(10px)"}, {opacity: 0, transform: "translateY(34px)"}], {duration: 900, easing: "ease-in"});
    at(900, () => { d.style.opacity = 0; });
  }));
}
function boxLabel(x, y, name, color, sub) {
  const e = s("text", {x, y, style: `font:700 23px var(--f-body);fill:${color}`});
  const a = s("tspan", {}); a.textContent = name; e.append(a);
  if (sub) { const b = s("tspan", {dx: 12, style: "font:400 18px var(--f-body);fill:#8c98a5"}); b.textContent = sub; e.append(b); }
  return e;
}
/* a moisture readout under a box: drop icon + number */
function readout(cx, cy, val) {
  const num = t(cx + 16, cy + 1, `${val}%`, "font:700 24px var(--f-body);fill:#edf2f7;text-anchor:middle;dominant-baseline:central");
  const g = grp(s("rect", {x: cx - 70, y: cy - 23, width: 140, height: 46, rx: 23, fill: K.surface2, stroke: HAIR, "stroke-width": 1.5}),
    ico("drop", cx - 52, cy - 12, 24, ORANGE), num);
  return {g, num, set(v) { num.textContent = `${v}%`; }};
}
const quiet = (x, y, str, anchor = "middle", size = 16) => t(x, y, str, `font:400 ${size}px var(--f-body);fill:#8c98a5;text-anchor:${anchor}`);

ID = "title";
/* ================= 1. title (with the Taproot logo mark, from farm-hand/brand/logo/taproot/symbol-dark.svg) ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 600", role: "img", "aria-label": "Farm Hand"});
  const mark = grp(s("g", {transform: "translate(496,6) scale(3.35)"},
    s("path", {d: "M24 19.5C24 12.5 19 8 10.5 8c0 7.5 5 11.5 13.5 11.5z", fill: "#5cb57e"}),
    s("path", {d: "M24 15.5C24 9.5 27.8 5 36.5 5c0 6.5-4 10.5-12.5 10.5z", fill: "#5cb57e"}),
    s("path", {d: "M24 15v11", stroke: "#5cb57e", "stroke-width": 3.6}),
    s("path", {d: "M8 27.5h32", stroke: "#eef1ea", "stroke-width": 3.6, "stroke-linecap": "round"}),
    s("path", {d: "M20.2 31.2h7.6v10L24 46.5l-3.8-5.3z", fill: "#5b9cf0"})));
  const word = s("text", {x: 576, y: 318, style: "font:700 130px var(--f-display);fill:#edf2f7;text-anchor:middle"});
  const a = s("tspan", {}); a.textContent = "Farm ";
  const b = s("tspan", {style: "fill:#3987e5"}); b.textContent = "Hand";
  word.append(a, b);
  const title = grp(word);
  const sub = t(576, 380, "It waters plants only when the soil is dry", "font:600 30px var(--f-body);fill:#b3bec9;text-anchor:middle");
  const names = grp(...FH.names.map((n, i) => t(336 + i * 240, 480, n, "font:700 24px var(--f-body);fill:#edf2f7;text-anchor:middle")));
  const event = t(576, 526, "ShellHacks 2026", "font:400 20px var(--f-body);fill:#8c98a5;text-anchor:middle");
  svg.append(mark, title, sub, names, event);
  const el = h("section", {class: "slide", style: "grid-template-rows:minmax(0,1fr)"}, h("div", {class: "art"}, svg), h("i", {class: "prog"}));
  const steps = [() => {
    show(mark, POP, 800); at(350, () => show(title, RISE, 900)); at(800, () => show(sub, FADE, 700));
    at(1100, () => { show(names, RISE, 700); show(event, FADE, 700); });
  }];
  addSlide({el, steps, pace: FH.pace, all: [mark, title, sub, names, event]});
}

ID = "hook";
/* ================= 2. the hook: a dead crop costs the time it took to grow ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "A plant grows for two years, dies, and the clock goes back to zero"});
  const X0 = 80, X1 = 1072, BY = 396;
  const track = s("rect", {x: X0, y: BY, width: X1 - X0, height: 24, rx: 12, fill: K.surface2});
  const bar = s("rect", {x: X0, y: BY, width: X1 - X0, height: 24, rx: 12, fill: GREEN});
  const ticks = grp(...[["Planted", 0, "start"], ["6 months", .25, "middle"], ["1 year", .5, "middle"], ["18 months", .75, "middle"], ["2 years", 1, "end"]].map(([l, f, anc]) =>
    t(X0 + (X1 - X0) * f, BY + 58, l, `font:600 19px var(--f-body);fill:#b3bec9;text-anchor:${anc}`)));
  /* the plant: one stem, six leaves, drawn around a base at (576, 350) */
  const leaf = (x, y, len, ang) => s("path", {d: `M0,0 C${len * .3},${-len * .3} ${len * .7},${-len * .3} ${len},0 C${len * .7},${len * .3} ${len * .3},${len * .3} 0,0 Z`, fill: GREEN, transform: `translate(${x},${y}) rotate(${ang})`});
  const stem = s("path", {d: "M576,352 C576,300 571,250 576,176", fill: "none", stroke: GREEN, "stroke-width": 7, "stroke-linecap": "round"});
  const leaves = [leaf(575, 312, 100, -158), leaf(577, 312, 104, -22), leaf(574, 258, 86, -150), leaf(576, 256, 90, -32), leaf(576, 204, 66, -125), leaf(577, 202, 64, -58)];
  const plant = grp(stem, ...leaves);
  plant.style.transformOrigin = "50% 100%";
  const dead = "#7d6b55";
  const cross = grp(ico("x", 516, 170, 120, RED));
  const back = t(X0, BY - 22, "Back to day 1", "font:700 22px var(--f-body);fill:#e5534b");
  const lost = grp(s("rect", {x: X0, y: BY, width: X1 - X0, height: 24, rx: 12, fill: "rgba(229,83,75,.12)", stroke: RED, "stroke-width": 2, "stroke-dasharray": "8 7"}),
    t(X1, BY - 22, "2 years of growing, lost", "font:700 22px var(--f-body);fill:#e5534b;text-anchor:end"));
  const note = quiet(X1, 488, "Palm growers: “maybe even 2 years” to grow back. Gene McAvoy, A1 Palms, news interview", "end", 15);
  svg.append(track, lost, bar, ticks, plant, cross, back);
  const el = frame("", "When a plant dies, you lose all the time it took to grow it", svg);
  const steps = [
    () => { show(track, FADE, 300); show(ticks, FADE, 500); grow(bar, "x", 2400);
      show(plant, [{opacity: .9, transform: "scale(.12)"}, {opacity: 1, transform: "none"}], 2400); },
    () => {
      [stem, ...leaves].forEach((p) => { const prop = p === stem ? "stroke" : "fill";
        play(p, [{[prop]: GREEN}, {[prop]: dead}], {duration: 700, easing: EASE}); p.style[prop] = dead; });
      play(plant, [{transform: "none"}, {transform: "rotate(7deg) scaleY(.9)"}], {duration: 700, easing: EASE}); plant.style.transform = "rotate(7deg) scaleY(.9)";
      at(500, () => show(cross, POP, 500));
      at(900, () => { play(bar, [{transform: "none"}, {transform: "scaleX(0)"}], {duration: 1100, easing: "cubic-bezier(.5,0,.3,1)"}); bar.style.transform = "scaleX(0)"; });
      at(1900, () => { show(lost, FADE, 500); show(back, RISE, 500); });
    },
  ];
  addSlide({el, steps, pace: FH.pace, all: [track, lost, bar, ticks, plant, cross, back],
    onReset() { stem.style.stroke = GREEN; leaves.forEach((l) => l.style.fill = GREEN); }});
}

ID = "drought";
/* ================= 3. Florida's drought, US Drought Monitor weekly ================= */
{
  const W = [["2025-12-30",83.25,3.55],["2026-01-06",86.95,3.55],["2026-01-13",91.91,4.78],["2026-01-20",92.76,4.78],["2026-01-27",94.01,14.02],["2026-02-03",95.46,24.09],["2026-02-10",98.77,43.4],["2026-02-17",98.77,67.39],["2026-02-24",100,67.39],["2026-03-03",100,70.51],["2026-03-10",100,72.9],["2026-03-17",99.8,72.49],["2026-03-24",99.8,72.89],["2026-03-31",99.51,79.5],["2026-04-07",99.51,79.5],["2026-04-14",98.99,71.16],["2026-04-21",99.02,76.65],["2026-04-28",98.66,78.51],["2026-05-05",98.66,81.9],["2026-05-12",99.26,80.63],["2026-05-19",99.26,74.61],["2026-05-26",99.26,64.47],["2026-06-02",98.63,53.1],["2026-06-09",95.11,31.12],["2026-06-16",91.9,23.46],["2026-06-23",79.67,19.88],["2026-06-30",79.96,18.04],["2026-07-07",75.71,16.18],["2026-07-14",75.71,16.18],["2026-07-21",75.54,14.31],["2026-07-28",72.52,14.3],["2026-08-04",69.67,8.98],["2026-08-11",67.41,8.7],["2026-08-18",65.86,9.04],["2026-08-25",67.14,9.7],["2026-09-01",66.18,3.58],["2026-09-08",58.68,2.01],["2026-09-15",54.52,2.01]];
  const X0 = 90, X1 = 880, Y0 = 440, n = W.length - 1;
  const X = (i) => X0 + (X1 - X0) * i / n, Y = (v) => Y0 - v * 3.8;
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "Share of Florida in drought, weekly, 2026"});
  const line = (k) => W.map((r, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(" ");
  const area = (k) => `${line(k)} L${X1},${Y0} L${X0},${Y0} Z`;
  const any = s("g", {}, s("path", {d: area(1), fill: "rgba(179,190,201,.10)"}), s("path", {d: line(1), fill: "none", stroke: K.ink2, "stroke-width": 2.6, "stroke-linejoin": "round"}));
  const ext = s("g", {}, s("path", {d: area(2), fill: "rgba(229,83,75,.24)"}), s("path", {d: line(2), fill: "none", stroke: RED, "stroke-width": 3.2, "stroke-linejoin": "round"}));
  const cover = s("rect", {x: X0 - 4, y: 0, width: X1 - X0 + 30, height: Y0 + 2, fill: K.ground});
  const grid = s("g", {});
  [0, 50, 100].forEach((v) => grid.append(s("path", {d: `M${X0},${Y(v)} H${X1}`, stroke: v ? "rgba(237,242,247,.10)" : K.axis, "stroke-width": v ? 1.2 : 2}),
    t(X0 - 14, Y(v) + 6, `${v}%`, "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:end")));
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"].forEach((m, k) => {
    const i = W.findIndex((r) => +r[0].slice(5, 7) === k + 1);
    grid.append(t(X(i), Y0 + 30, m, "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:middle"));
  });
  const legend = grp(s("rect", {x: X0, y: -2, width: 26, height: 12, rx: 3, fill: RED}), t(X0 + 36, 10, "Extreme drought or worse", "font:600 18px var(--f-body);fill:#edf2f7"),
    s("rect", {x: X0 + 300, y: -2, width: 26, height: 12, rx: 3, fill: K.ink2}), t(X0 + 336, 10, "Any drought", "font:600 18px var(--f-body);fill:#edf2f7"));
  const iA = 14, peak = grp(s("path", {d: `M${X(iA)},${Y(79.5) + 10} V${Y(79.5) + 58}`, stroke: K.ink, "stroke-width": 1.6}),
    s("circle", {cx: X(iA), cy: Y(79.5), r: 7, fill: RED, stroke: K.ground, "stroke-width": 3}),
    t(X(iA) - 100, Y(79.5) + 88, "79.5% of Florida", `font:700 24px var(--f-body);fill:#edf2f7;${HALO}`),
    t(X(iA) - 100, Y(79.5) + 116, "in extreme drought, Apr 7", `font:400 20px var(--f-body);fill:#edf2f7;${HALO}`));
  const end = grp(s("circle", {cx: X1, cy: Y(54.52), r: 7, fill: K.ink2, stroke: K.ground, "stroke-width": 3}),
    t(X1 + 18, Y(54.52) - 4, "54.5% still", "font:700 22px var(--f-body);fill:#edf2f7"),
    t(X1 + 18, Y(54.52) + 22, "in drought, Sep 15", "font:400 19px var(--f-body);fill:#b3bec9"));
  const miami = grp(s("rect", {x: X1 + 14, y: 290, width: 250, height: 76, rx: 14, fill: K.surface, stroke: HAIR, "stroke-width": 1.5}),
    t(X1 + 32, 322, "Miami-Dade: 100%", "font:700 22px var(--f-body);fill:#edf2f7"),
    t(X1 + 32, 348, "in drought, Sep 15", "font:400 18px var(--f-body);fill:#b3bec9"));
  const src = quiet(1152, 496, "Source: US Drought Monitor, weekly maps", "end", 15);
  svg.append(any, ext, cover, grid, legend, peak, end, miami, src);
  const el = frame("", "80% of Florida hit extreme drought this spring, and it's still dry", svg);
  const to = (i) => `translateX(${X(i) - X0 + 2}px)`;
  const steps = [
    () => { show(grid, FADE, 400); show(legend, FADE, 400); show(any, FADE, 1); show(ext, FADE, 1);
      play(cover, [{transform: "none"}, {transform: to(iA)}], {duration: 1800, easing: "ease-in-out"}); cover.style.transform = to(iA);
      at(1700, () => show(peak, RISE, 600)); },
    () => { play(cover, [{transform: to(iA)}, {transform: `translateX(${X1 - X0 + 40}px)`}], {duration: 1800, easing: "ease-in-out"}); cover.style.transform = `translateX(${X1 - X0 + 40}px)`;
      at(1700, () => show(end, RISE, 500)); at(2200, () => { show(miami, RISE, 600); show(src, FADE, 400); }); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [any, ext, grid, legend, peak, end, miami, src], onReset() { cover.style.transform = ""; }});
}

ID = "quote";
/* ================= 4. the nursery (WINK News, Apr 27 2026) ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 600", role: "img", "aria-label": "Quote from San Juan Family Nursery"});
  const mark = t(96, 190, "“", "font:700 190px var(--f-display);fill:#38434f");
  const q = grp(...lines(170, 170, ["For some plants this season,", "they honestly just had to be", "thrown away."], 66, {style: "font:700 54px var(--f-display);fill:#edf2f7"}));
  const q2 = grp(...lines(170, 400, ["Then, when it comes to regrowing them…", "you kind of get backtracked a lot."], 40, {style: "font:400 30px var(--f-body);fill:#b3bec9"}));
  const who = grp(t(170, 520, "Ariely San Juan, San Juan Family Nursery, Bonita Springs", "font:700 21px var(--f-body);fill:#edf2f7"),
    t(170, 550, "WINK News, April 27, 2026", "font:400 18px var(--f-body);fill:#8c98a5"));
  svg.append(mark, q, q2, who);
  const el = h("section", {class: "slide", style: "grid-template-rows:minmax(0,1fr)"}, h("div", {class: "art"}, svg), h("i", {class: "prog"}));
  const steps = [() => { show(mark, FADE, 500); show(q, RISE, 800); at(700, () => show(q2, RISE, 700)); at(1200, () => show(who, FADE, 600)); }];
  addSlide({el, steps, pace: FH.pace, all: [mark, q, q2, who]});
}

ID = "timer";
/* ================= 5. a timer can't tell the difference ================= */
{
  SEED = 11;
  const svg = s("svg", {viewBox: "0 0 1152 520", role: "img", "aria-label": "Farm Hand waits on wet soil, the timer waters anyway"});
  const A = tote(120, 120, 390, 210), B = tote(700, 120, 390, 210);
  const la = boxLabel(74, 58, "Farm Hand", BLUE), lb = boxLabel(654, 58, "Timer", GOLD);
  const boxes = grp(A.g, B.g, la, lb);
  const ra = readout(315, 372, 38), rb = readout(895, 372, 38);
  /* rain on both boxes */
  const cloud = (cx) => s("path", {d: `M${cx - 60},${46} a26,26 0 0 1 18,-40 a34,34 0 0 1 62,-6 a26,26 0 0 1 40,22 a22,22 0 0 1 -6,24 Z`, fill: K.surface2, stroke: K.ink2, "stroke-width": 2});
  const rain = (cx, ys) => s("g", {}, ...[-40, -16, 8, 32].map((dx) => s("path", {d: `M${cx + dx},${60} l-8,${ys - 76}`, stroke: ORANGE, "stroke-width": 3, "stroke-linecap": "round", "stroke-dasharray": "10 16"})));
  const clouds = grp(cloud(390), cloud(970)), rains = grp(rain(390, A.ys), rain(970, B.ys));
  const clock = grp(ico("clock", 590, 196, 40, GOLD), t(610, 262, "7:00", "font:700 19px var(--f-body);fill:#f0b429;text-anchor:middle"));
  const waits = badge(315, 450, "Soil is wet. It waits.", "us", 290);
  const anyway = badge(895, 450, "Waters anyway", "vendor", 230);
  const later = pill(315, 20, "Two days later", K.axis, 200, K.surface2, 38, 17);
  const dryNow = badge(315, 450, "Dry now. Waters 5 s.", "us", 290);
  svg.append(boxes, clouds, rains, ra.g, rb.g, clock, waits, anyway, later, dryNow);
  const el = frame("", "A timer can't tell the difference", svg, "It waters on schedule, wet soil or dry.");
  const steps = [
    () => { show(boxes, FADE, 600); show(ra.g, FADE, 600); show(rb.g, FADE, 600);
      at(500, () => { show(clouds, FADE, 400); show(rains, FADE, 300); fadeTo(A.wet, .75, 1500); fadeTo(B.wet, .75, 1500); countTo(ra.num, 38, 62, 1500); countTo(rb.num, 38, 62, 1500); });
      at(2100, () => { fadeTo(clouds, 0, 400); fadeTo(rains, 0, 400); }); },
    () => { show(clock, POP, 500); at(400, () => { pumpRun(B, .92); runoff(B, 1200); }); at(500, () => { pulse(A.g, 1.02); show(waits, RISE, 600); }); at(1600, () => show(anyway, RISE, 600)); },
    () => { fadeTo(waits, 0, 300); show(later, FADE, 400); fadeTo(A.wet, .1, 1000); countTo(ra.num, 62, 38, 1000);
      at(1100, () => { show(dryNow, RISE, 500); pumpRun(A, .6); countTo(ra.num, 38, 55, 1600); }); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [boxes, ra.g, rb.g, clouds, rains, clock, waits, anyway, later, dryNow],
    onReset() { A.reset(); B.reset(); ra.set(38); rb.set(38); }});
}

ID = "how";
/* ================= 6. how it works ================= */
{
  SEED = 3;
  const svg = s("svg", {viewBox: "0 0 1152 520", role: "img", "aria-label": "Probes to ESP32 to Mac mini and back to the pump"});
  const A = tote(100, 74, 240, 150, {k: .72}), B = tote(100, 344, 240, 150, {k: .72});
  const la = boxLabel(40, 26, "Farm Hand", BLUE, "box A"), lb = boxLabel(40, 296, "Timer", GOLD, "box B");
  const boxes = grp(A.g, la), boxesB = grp(B.g, lb, ico("clock", 6, 404, 30, GOLD));
  /* ESP32 with its little screen */
  const E = {x: 460, y: 170, w: 200, h: 170};
  const oledA = t(E.x + 22, E.y + 46, "A   44%   26.1°C", "font:700 17px var(--f-body);fill:#9ec7f5");
  const oledB = t(E.x + 22, E.y + 72, "B   47%   26.0°C", "font:700 17px var(--f-body);fill:#9ec7f5");
  const pins = s("g", {}, ...Array.from({length: 11}, (_, i) => s("rect", {x: E.x + 18 + i * 15.5, y: E.y + E.h - 16, width: 8, height: 8, rx: 1.5, fill: K.axis})));
  const esp = grp(s("rect", {x: E.x, y: E.y, width: E.w, height: E.h, rx: 12, fill: K.surface2, stroke: K.ink2, "stroke-width": 2}),
    s("rect", {x: E.x + 12, y: E.y + 14, width: E.w - 24, height: 74, rx: 6, fill: "#05080b", stroke: K.axis, "stroke-width": 1.5}),
    oledA, oledB, s("rect", {x: E.x + 64, y: E.y + 102, width: 72, height: 42, rx: 4, fill: "#0e1419", stroke: K.axis, "stroke-width": 1.5}), pins);
  const espLab = grp(t(E.x + E.w / 2, E.y + E.h + 34, "ESP32", "font:700 22px var(--f-body);fill:#edf2f7;text-anchor:middle"),
    t(E.x + E.w / 2, E.y + E.h + 60, "reads every second", "font:400 18px var(--f-body);fill:#b3bec9;text-anchor:middle"));
  const wire = (p, y) => s("path", {d: `M${p[0]},${p[1]} C${p[0]},${p[1] - 40} ${E.x - 70},${y} ${E.x},${y}`, fill: "none", stroke: K.axis, "stroke-width": 2.4, "stroke-linecap": "round"});
  const wires = [wire(A.probeTop, 212), wire(A.tempTop, 232), wire(B.probeTop, 282), wire(B.tempTop, 302)];
  const wireG = s("g", {}, ...wires);
  /* Mac mini */
  const M = {x: 890, y: 150, w: 250, h: 200};
  const laya = block(M.x + 18, M.y + 58, M.w - 36, 64, "us", "robot", "Decision model", "decides in 115 ms");
  const mac = grp(s("rect", {x: M.x, y: M.y, width: M.w, height: M.h, rx: 18, fill: K.surface, stroke: K.ink2, "stroke-width": 2}),
    t(M.x + 20, M.y + 38, "Mac mini", "font:700 22px var(--f-body);fill:#edf2f7"), laya,
    ico("db", M.x + 20, M.y + 146, 28, K.ink2), t(M.x + 58, M.y + 166, "saves every reading", "font:400 18px var(--f-body);fill:#b3bec9"));
  const up = s("path", {d: `M${E.x + E.w + 6},215 C750,105 810,105 ${M.x - 6},215`, fill: "none", stroke: K.ink2, "stroke-width": 2.6, "stroke-linecap": "round"});
  const upHd = head(830, 150, M.x - 6, 215, K.ink2);
  const upLab = grp(ico("wifi", 757, 52, 30, K.ink2), t(772, 104, "FIU WiFi, every 10 s", `font:700 18px var(--f-body);fill:#b3bec9;text-anchor:middle;${HALO}`));
  const dn = s("path", {d: `M${M.x - 6},300 C810,410 750,410 ${E.x + E.w + 6},300`, fill: "none", stroke: BLUE, "stroke-width": 2.6, "stroke-linecap": "round"});
  const dnHd = head(700, 360, E.x + E.w + 6, 300, BLUE);
  const dnLab = t(772, 384, "“water 5 s”", `font:700 21px var(--f-body);fill:#9ec7f5;text-anchor:middle;${HALO}`);
  const safe = block(E.x - 16, E.y + E.h + 88, 232, 62, "ext", "shield", "Safety rules", "on the board itself");
  const dot = dotOf(svg, 8);
  svg.append(wireG, boxes, boxesB, esp, espLab, up, upHd, upLab, mac, dn, dnHd, dnLab, safe, dot);
  const el = frame("", "How the data moves: soil probes, the board, WiFi, our AI, then the pump", svg);
  const steps = [
    () => { show(boxes, SLIDE_L, 700); at(250, () => show(boxesB, SLIDE_L, 700)); },
    () => { show(esp, POP, 600); show(espLab, FADE, 600); oledA.style.opacity = 0; oledB.style.opacity = 0;
      at(300, () => { wireG.style.opacity = ""; wires.forEach((w) => draw(w, 700)); });
      at(1000, () => wires.forEach((w, i) => { const d = i ? dotOf(svg, 6) : dot; travel(w, d, 700, () => { if (d !== dot) d.remove(); }); }));
      at(1700, () => { show(oledA, FADE, 300); show(oledB, FADE, 300); }); },
    () => { draw(up, 800); show(upLab, FADE, 400); travel(up, dot, 900, () => { show(upHd, FADE, 200); show(mac, POP, 600); }); },
    () => { pulse(laya, 1.05); at(500, () => { draw(dn, 800); show(dnLab, FADE, 400); travel(dn, dot, 900, () => { show(dnHd, FADE, 200); show(safe, RISE, 500); at(500, () => pulse(safe, 1.06)); }); }); },
    () => { pumpRun(A, .7, 800); at(300, () => pulse(la, 1.05)); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [boxes, boxesB, esp, espLab, wireG, up, upHd, upLab, mac, dn, dnHd, dnLab, safe],
    onReset() { A.reset(); B.reset(); oledA.style.opacity = ""; oledB.style.opacity = ""; }});
}

ID = "cup";
/* ================= 7. the cup test (a drawing of the live demo, and its backup) ================= */
{
  SEED = 19;
  const svg = s("svg", {viewBox: "0 0 1152 520", role: "img", "aria-label": "A judge pours a cup into both boxes"});
  const A = tote(120, 120, 390, 210), B = tote(700, 120, 390, 210);
  const boxes = grp(A.g, B.g, boxLabel(74, 58, "Farm Hand", BLUE), boxLabel(654, 58, "Timer", GOLD));
  const ra = readout(315, 372, 44), rb = readout(895, 372, 45);
  /* a hand-held cup, tipped, pouring */
  const cup = (cx) => {
    const inner = s("g", {transform: `translate(${cx},34) rotate(-118)`},
      s("path", {d: "M-24,-30 L24,-30 L18,30 L-18,30 Z", fill: "rgba(237,242,247,.08)", stroke: K.ink, "stroke-width": 2.4, "stroke-linejoin": "round"}));
    const pourD = `M${cx - 24},${46} C${cx - 34},${70} ${cx - 34},${110} ${cx - 34},${A.ys + 2}`;
    const pour = s("path", {d: pourD, fill: "none", stroke: ORANGE, "stroke-width": 7, "stroke-linecap": "round"});
    pour.style.opacity = 0;
    return {g: grp(inner), pour};
  };
  const ca = cup(360), cb = cup(940);
  const clock = grp(ico("clock", 590, 196, 40, GOLD), t(610, 262, "next drink", "font:700 17px var(--f-body);fill:#f0b429;text-anchor:middle"));
  const skip = badge(315, 450, "Skips its next drink", "us", 290);
  const anyway = badge(895, 450, "Waters anyway", "vendor", 230);
  svg.append(boxes, ra.g, rb.g, ca.g, cb.g, ca.pour, cb.pour, clock, skip, anyway);
  const el = frame("", "Pour water in both boxes: Farm Hand skips its next watering, the timer waters anyway", svg);
  const pourCup = (c, T, r, from, to) => { show(c.g, SLIDE_R, 500); at(500, () => { draw(c.pour, 400); fadeTo(T.wet, .7, 1300); countTo(r.num, from, to, 1300); });
    at(1700, () => { fadeTo(c.pour, 0, 300); fadeTo(c.g, 0, 400); }); };
  const steps = [
    () => { show(boxes, FADE, 600); show(ra.g, FADE, 600); show(rb.g, FADE, 600); },
    () => { pourCup(ca, A, ra, 44, 58); at(250, () => pourCup(cb, B, rb, 45, 59)); },
    () => { show(skip, RISE, 600); at(300, () => pulse(A.g, 1.02)); at(700, () => show(clock, POP, 500));
      at(1100, () => { pumpRun(B, .95); runoff(B, 1100); }); at(2100, () => show(anyway, RISE, 600)); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [boxes, ra.g, rb.g, ca.g, cb.g, clock, skip, anyway],
    onReset() { A.reset(); B.reset(); ra.set(44); rb.set(45); ca.pour.style.opacity = 0; cb.pour.style.opacity = 0; }});
}

ID = "laya";
/* ================= 8. Laya makes the call ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "The decision model: 94.1% right, 115 ms per decision"});
  const cells = [];
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), c = i % 10, right = i < 94;
    cells.push(s("rect", {x: 40 + c * 42, y: 30 + r * 42, width: 34, height: 34, rx: 7, fill: right ? BLUE : "none", stroke: right ? "none" : K.muted, "stroke-width": 2}));
  }
  const waffle = s("g", {}, ...cells);
  const big = grp(t(560, 130, "94.1%", "font:700 104px var(--f-display);fill:#edf2f7"),
    t(564, 178, "right on 7,524 decisions", "font:700 26px var(--f-body);fill:#edf2f7"),
    t(564, 212, "from 2025 and 2026 Miami weather it never trained on", "font:400 20px var(--f-body);fill:#b3bec9"));
  const key = grp(s("rect", {x: 40, y: 462, width: 18, height: 18, rx: 4, fill: BLUE}), t(68, 477, "right", "font:400 17px var(--f-body);fill:#b3bec9"),
    s("rect", {x: 136, y: 462, width: 18, height: 18, rx: 4, fill: "none", stroke: K.muted, "stroke-width": 2}), t(164, 477, "wrong", "font:400 17px var(--f-body);fill:#b3bec9"));
  const fast = grp(ico("clock", 564, 290, 64, BLUE), t(650, 352, "115 ms", "font:700 88px var(--f-display);fill:#edf2f7"),
    t(564, 400, "for each decision", "font:700 26px var(--f-body);fill:#edf2f7"),
    t(564, 434, "a small AI model we trained ourselves", "font:400 20px var(--f-body);fill:#b3bec9"));
  svg.append(waffle, big, key, fast);
  const el = frame("", "Our decision model makes the right call 94% of the time, in a tenth of a second", svg);
  const steps = [
    () => { waffle.style.opacity = ""; cells.forEach((c, i) => { c.style.opacity = 0; at(i * 14, () => show(c, POP, 400)); }); show(key, FADE, 600); at(900, () => show(big, RISE, 700)); },
    () => show(fast, RISE, 700),
  ];
  addSlide({el, steps, pace: FH.pace, all: [waffle, big, key, fast], onReset() { cells.forEach((c) => c.style.opacity = ""); }});
}

ID = "crops";
/* ================= 9. crop engine: every crop scored against the live probe ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 510", role: "img", "aria-label": "Crops scored against the live soil reading"});
  const now = grp(card(0, 20, 330, 190, 18),
    t(26, 62, "Box A right now", "font:700 22px var(--f-body);fill:#edf2f7"),
    ico("therm", 24, 88, 38, ORANGE), t(72, 122, "24 °C", "font:700 40px var(--f-display);fill:#edf2f7"),
    ico("drop", 190, 88, 38, ORANGE), t(236, 122, "44%", "font:700 40px var(--f-display);fill:#edf2f7"),
    t(26, 180, "soil temperature and moisture", "font:400 17px var(--f-body);fill:#8c98a5"));
  const crops = ["Strawberries", "Blueberries", "Tomatoes", "Peppers", "Sweet potatoes", "Taro", "Lettuce"];
  const rows = crops.map((c, i) => grp(s("rect", {x: 400, y: 20 + i * 54, width: 330, height: 44, rx: 10, fill: K.surface, stroke: i ? HAIR : BLUE, "stroke-width": i ? 1.5 : 2.4}),
    ico("sprout", 414, 30 + i * 54, 24, GREEN), t(452, 48 + i * 54, c, "font:700 19px var(--f-body);fill:#edf2f7")));
  const more = t(400, 420, "and 19 more crops", "font:400 18px var(--f-body);fill:#8c98a5");
  const link = s("path", {d: "M330,115 C370,115 370,42 398,42", fill: "none", stroke: ORANGE, "stroke-width": 2.6, "stroke-linecap": "round"});
  const why = grp(card(790, 20, 362, 214, 18, K.surface, BLUE, 2.4),
    t(814, 60, "Strawberries", "font:700 24px var(--f-body);fill:#edf2f7"),
    ...lines(814, 100, ["Soil is 24 °C.", "Strawberries want 15 to 26 °C."], 32, {style: "font:400 22px var(--f-body);fill:#edf2f7"}),
    t(814, 200, "Every score shows the numbers behind it.", "font:400 16px var(--f-body);fill:#b3bec9"));
  const unk = grp(card(790, 256, 362, 104, 18, K.surface, "rgba(237,242,247,.25)", 1.5),
    t(814, 296, "Not measured?", "font:700 21px var(--f-body);fill:#edf2f7"),
    t(814, 330, "It says “unknown”, never a guess.", "font:400 20px var(--f-body);fill:#b3bec9"));
  const dot = dotOf(svg, 7);
  svg.append(now, ...rows, more, link, why, unk);
  svg.append(dot);
  const el = frame("", "It tells you which crops fit your soil right now", svg, "It checks 26 crops against the live soil readings.");
  const steps = [
    () => { show(now, SLIDE_L, 600); rows.forEach((r, i) => at(300 + i * 90, () => show(r, RISE, 500))); at(1000, () => show(more, FADE, 400)); },
    () => { draw(link, 600); travel(link, dot, 600, () => { pulse(rows[0], 1.04); show(why, RISE, 600); }); },
    () => show(unk, RISE, 600),
  ];
  addSlide({el, steps, pace: FH.pace, all: [now, ...rows, more, link, why, unk]});
}

ID = "map";
/* ================= next: from one box to every farm field (AlphaEarth v2, real map from the site) ================= */
{
  SEED = 29;
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "Today one box, next 1,347 farms in Miami-Dade"});
  const T = tote(60, 170, 200, 130, {k: .65});
  const today = grp(T.g, t(160, 90, "Today", "font:700 30px var(--f-body);fill:#3987e5;text-anchor:middle"),
    t(160, 360, "One box on our table", "font:700 22px var(--f-body);fill:#edf2f7;text-anchor:middle"));
  const arrow = s("path", {d: "M292,240 H352", stroke: K.ink2, "stroke-width": 4, "stroke-linecap": "round"});
  const tip = head(292, 240, 364, 240, K.ink2, 18);
  const MX = 384, MW = 460, MH = MW * 724 / 1040, MY = 60;
  const clip = s("clipPath", {id: "fields-clip"}, s("rect", {x: MX, y: MY, width: MW, height: MH, rx: 14}));
  const map = grp(t(MX + MW / 2, 44, "Next", "font:700 30px var(--f-body);fill:#3fb96f;text-anchor:middle"), clip,
    IMG.fields ? s("image", {href: IMG.fields, x: MX, y: MY, width: MW, height: MH, "clip-path": "url(#fields-clip)", preserveAspectRatio: "xMidYMid slice"}) : card(MX, MY, MW, MH, 14),
    s("rect", {x: MX, y: MY, width: MW, height: MH, rx: 14, fill: "none", stroke: HAIR, "stroke-width": 1.5}),
    t(MX + MW + 34, 190, "1,347", "font:700 76px var(--f-display);fill:#edf2f7"),
    t(MX + MW + 36, 228, "farms", "font:700 26px var(--f-body);fill:#edf2f7"),
    t(MX + MW + 36, 260, "in Miami-Dade,", "font:400 21px var(--f-body);fill:#b3bec9"),
    t(MX + MW + 36, 288, "found from satellite", "font:400 21px var(--f-body);fill:#b3bec9"),
    t(MX + MW + 36, 344, "18,865 acres", "font:700 21px var(--f-body);fill:#edf2f7"));
  svg.append(today, arrow, tip, map);
  const el = frame("", "Today it runs on one box. Next, it can run on real farms, and we already know where they are.", svg);
  const steps = [
    () => show(today, SLIDE_L, 700),
    () => { draw(arrow, 400); at(400, () => { show(tip, FADE, 150); show(map, RISE, 900); }); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [today, arrow, tip, map], onReset() { T.reset(); }});
}

ID = "fieldcrops";
/* ================= backup: what grows on those fields (AlphaEarth v2) ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Crops on 1,347 farms"});
  const R = [["Avocados", 727, 10153, "#8fd14f"], ["Vegetables and row crops", 447, 6997, "#f2c94c"], ["Mango, lychee, tree fruit", 149, 1508, "#f2994a"], ["Sugarcane, sod, citrus", 24, 203, "#8c98a5"]];
  const rows = R.map(([n, f, a, c], i) => {
    const y = 10 + i * 88;
    return {bar: s("rect", {x: 330, y, width: Math.max(560 * f / 727, 6), height: 56, rx: 8, fill: c}),
      g: grp(t(310, y + 38, n, "font:700 22px var(--f-body);fill:#edf2f7;text-anchor:end"),
        t(330 + Math.max(560 * f / 727, 6) + 18, y + 28, `${f} farms`, "font:700 24px var(--f-body);fill:#edf2f7"),
        t(330 + Math.max(560 * f / 727, 6) + 18, y + 52, `${a.toLocaleString("en-US")} acres`, "font:400 18px var(--f-body);fill:#b3bec9"))};
  });
  const acc = grp(t(330, 400, "Crop type right 87% of the time,", "font:700 22px var(--f-body);fill:#edf2f7"),
    t(330, 430, "on fields the model never trained on.", "font:400 20px var(--f-body);fill:#b3bec9"));
  const src = quiet(1152, 474, "Google DeepMind AlphaEarth, 2025. 1,347 farms, 18,865 acres in Miami-Dade.", "end", 15);
  rows.forEach((r) => svg.append(r.bar, r.g));
  svg.append(acc, src);
  const el = frame("", "The satellite tells us what grows on each farm, so each gets the right amount of water", svg);
  addSlide({el, steps: [() => rows.forEach((r, i) => at(i * 200, () => { show(r.g, FADE, 400); grow(r.bar, "x", 800); })), () => { show(acc, RISE, 600); show(src, FADE, 500); }],
    pace: FH.pace, all: [...rows.flatMap((r) => [r.bar, r.g]), acc, src]});
}

ID = "results";
/* ================= results: both boxes side by side, 1 AM to 4:10 PM (redrawn from the site's Results panel) ================= */
{
  const R = FH.results, saved = (R.timerL - R.layaL).toFixed(1), pct = Math.round((1 - R.layaL / R.timerL) * 100);
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": `Farm Hand used ${saved} L less water than the timer`});
  const X0 = 330, X1 = 1140, X = (f) => X0 + f * (X1 - X0), Y = (v) => 372 - (v - 40) / 60 * 350;
  /* soil moisture paths: the timer pours every 2 h no matter what; Laya drinks only when it reaches its line */
  const pours = [[.01, 60], [.13, 65.5], [.26, 71.5], [.39, 75], [.52, 81.5], [.66, 88.5], [.79, 93.5], [.92, 94.5]];
  let d = `M${X(0)},${Y(58)}`, low = 58;
  pours.forEach(([f, v], k) => { const nx = k < 7 ? pours[k + 1][0] : 1; d += ` L${X(f)},${Y(low)} L${X(f + .004)},${Y(v)} L${X(nx)},${Y(v - 1.8)}`; low = v - 1.8; });
  const tLine = s("path", {d, fill: "none", stroke: GOLD, "stroke-width": 3.2, "stroke-linejoin": "round"});
  const lLine = s("path", {d: `M${X(0)},${Y(50)} L${X(.39)},${Y(45.4)} L${X(.395)},${Y(54)} L${X(.965)},${Y(45.4)} L${X(.97)},${Y(54)} L${X(1)},${Y(53.8)}`, fill: "none", stroke: BLUE, "stroke-width": 3.2, "stroke-linejoin": "round"});
  const grid = grp(s("rect", {x: X0, y: Y(100), width: X1 - X0, height: Y(70) - Y(100), fill: "rgba(240,180,41,.07)"}),
    t(X1 - 10, Y(100) + 24, "soggy", "font:700 17px var(--f-body);fill:#f0b429;text-anchor:end"),
    s("path", {d: `M${X0},${Y(45)} H${X1}`, stroke: K.ink2, "stroke-width": 1.6, "stroke-dasharray": "6 6"}),
    t(X0 + 8, Y(45) + 24, `Its line, ${R.floor}%`, "font:400 16px var(--f-body);fill:#b3bec9"),
    ...[[45, "45%"], [70, "70%"], [100, "100%"]].map(([v, l]) => t(X0 - 10, Y(v) + 6, l, "font:400 15px var(--f-body);fill:#8c98a5;text-anchor:end")),
    t(X0, 400, "1 AM", "font:400 16px var(--f-body);fill:#8c98a5"), t(X1, 400, "4:10 PM", "font:400 16px var(--f-body);fill:#8c98a5;text-anchor:end"));
  const stat = (y, name, color, liters, what) => grp(t(0, y, name, `font:700 24px var(--f-body);fill:${color}`),
    t(0, y + 62, `${liters} L`, "font:700 58px var(--f-display);fill:#edf2f7"), t(0, y + 94, what, "font:400 20px var(--f-body);fill:#b3bec9"));
  const tStat = stat(30, "Timer", GOLD, R.timerL, `${R.timerPours} pours, every 2 hours`);
  const lStat = stat(200, "Farm Hand", BLUE, R.layaL, `${R.layaDrinks} drinks, only when dry`);
  const big = grp(s("rect", {x: 0, y: 424, width: 1152, height: 70, rx: 16, fill: "rgba(57,135,229,.14)", stroke: BLUE, "stroke-width": 2}),
    t(576, 468, `${pct}% less water. Same soil, same room, side by side.`, "font:700 26px var(--f-body);fill:#edf2f7;text-anchor:middle"));
  const tag = R.tag ? pill(1152 - (R.tag.length * 9 + 40) / 2, 0, R.tag, K.axis, R.tag.length * 9 + 40, K.surface2, 32, 15) : null;
  svg.append(grid, tLine, lLine, tStat, lStat, big); if (tag) svg.append(tag);
  const el = frame("", `Farm Hand used ${saved} L less water than the timer`, svg);
  addSlide({el, steps: [
      () => { show(grid, FADE, 400); show(tStat, RISE, 600); draw(tLine, 1600); if (tag) show(tag, FADE, 400); },
      () => { show(lStat, RISE, 600); draw(lLine, 1600); },
      () => show(big, POP, 600)],
    pace: FH.pace, all: [grid, tLine, lLine, tStat, lStat, big, ...(tag ? [tag] : [])]});
}

ID = "season";
/* ================= 11. season replay (simulated field, real weather) ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "Timer 3.55 million gallons per acre, Farm Hand 1.55 million"});
  const L = 220, MAXW = 800, sc = MAXW / 3545691;
  const row = (y, name, color, gal) => {
    const bar = s("rect", {x: L, y, width: gal * sc, height: 70, rx: 10, fill: color});
    const lab = t(L - 22, y + 45, name, `font:700 26px var(--f-body);fill:${color};text-anchor:end`);
    const val = t(L, y - 14, `${(gal / 1e6).toFixed(1)} million gallons per acre`, "font:700 21px var(--f-body);fill:#edf2f7");
    return {bar, lab, val};
  };
  const T = row(50, "Timer", GOLD, 3545691), La = row(200, "Farm Hand", BLUE, 1553052);
  const gapX = L + 1553052 * sc, gapW = MAXW - 1553052 * sc;
  const saved = grp(s("rect", {x: gapX + 6, y: 200, width: gapW - 6, height: 70, rx: 10, fill: "none", stroke: K.ink2, "stroke-width": 2, "stroke-dasharray": "7 7"}),
    t(gapX + gapW / 2 + 3, 232, "56% less water", "font:700 22px var(--f-body);fill:#edf2f7;text-anchor:middle"),
    t(gapX + gapW / 2 + 3, 258, "2 million gallons saved per acre", "font:400 19px var(--f-body);fill:#b3bec9;text-anchor:middle"));
  const stress = grp(t(L - 22, 372, "Hours the crop", "font:700 20px var(--f-body);fill:#edf2f7;text-anchor:end"),
    t(L - 22, 398, "went thirsty", "font:700 20px var(--f-body);fill:#edf2f7;text-anchor:end"),
    ...Array.from({length: 12}, (_, i) => s("rect", {x: L + i * 26, y: 350, width: 18, height: 50, rx: 4, fill: GOLD})),
    t(L + 12 * 26 + 12, 388, "12 hours, timer", "font:700 22px var(--f-body);fill:#f0b429"),
    s("rect", {x: L + 560, y: 350, width: 18, height: 50, rx: 4, fill: "none", stroke: BLUE, "stroke-width": 2, "stroke-dasharray": "4 4"}),
    t(L + 592, 388, "0 hours, Farm Hand", "font:700 22px var(--f-body);fill:#9ec7f5"));
  svg.append(T.bar, T.lab, T.val, La.bar, La.lab, La.val, saved);
  const el = frame("", "Farm Hand used less than half the water of a normal timer", svg, "Same field, same weather, over a whole season: our season replay on real Miami weather.");
  const steps = [
    () => { show(T.lab, FADE, 400); grow(T.bar, "x", 1400); at(1000, () => show(T.val, FADE, 400)); },
    () => { show(La.lab, FADE, 400); grow(La.bar, "x", 900); at(700, () => show(La.val, FADE, 400)); at(1000, () => show(saved, FADE, 700)); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [T.bar, T.lab, T.val, La.bar, La.lab, La.val, saved]});
}

ID = "cost";
/* ================= 12. cost ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "One CropX sensor $1,200 to $1,512, our whole parts order $72.94"});
  const BASE = 380, sc = 300 / 1512;
  const cx1 = 150, cx2 = 530, bw = 220;
  const solid = s("rect", {x: cx1, y: BASE - 1200 * sc, width: bw, height: 1200 * sc, rx: 8, fill: "rgba(240,180,41,.22)", stroke: GOLD, "stroke-width": 2.4});
  const range = s("rect", {x: cx1, y: BASE - 1512 * sc, width: bw, height: 312 * sc, rx: 8, fill: "none", stroke: GOLD, "stroke-width": 2, "stroke-dasharray": "6 6"});
  const big1 = grp(t(cx1 + bw / 2, BASE - 1512 * sc - 24, "$1,200 to $1,512", "font:700 36px var(--f-display);fill:#f0b429;text-anchor:middle"),
    t(cx1 + bw / 2, BASE + 40, "One CropX soil sensor", "font:700 21px var(--f-body);fill:#edf2f7;text-anchor:middle"),
    t(cx1 + bw / 2, BASE + 68, "plus $309 a year for data", "font:400 18px var(--f-body);fill:#b3bec9;text-anchor:middle"));
  const ours = s("rect", {x: cx2, y: BASE - 72.94 * sc, width: bw, height: 72.94 * sc, rx: 5, fill: BLUE});
  const big2 = grp(t(cx2 + bw / 2, BASE - 72.94 * sc - 24, "$72.94", "font:700 36px var(--f-display);fill:#3987e5;text-anchor:middle"),
    t(cx2 + bw / 2, BASE + 40, "Our whole parts order", "font:700 21px var(--f-body);fill:#edf2f7;text-anchor:middle"),
    t(cx2 + bw / 2, BASE + 68, "and that's 5 probes", "font:400 18px var(--f-body);fill:#b3bec9;text-anchor:middle"));
  const base = s("path", {d: `M100,${BASE} H800`, stroke: K.axis, "stroke-width": 2});
  const parts = grp(...[["chip", "3 ESP32 boards"], ["drop", "5 moisture probes"], ["therm", "5 temperature probes"], ["cup", "4 pumps and tubing"], ["bolt", "relays"]].map(([i, l], k) =>
    s("g", {}, ico(i, 850, 90 + k * 50, 28, BLUE), t(892, 112 + k * 50, l, "font:400 20px var(--f-body);fill:#edf2f7"))));
  const src = quiet(1152, 494, "Sensor prices: Roberts Irrigation and IrrigationBox, checked Sep 26, 2026.", "end", 15);
  svg.append(base, solid, range, big1, ours, big2, parts, src);
  const el = frame("", "It runs on cheap parts", svg);
  const steps = [
    () => { show(base, FADE, 300); grow(solid, "y", 1000); at(700, () => show(range, FADE, 500)); at(900, () => show(big1, RISE, 600)); show(src, FADE, 600); },
    () => { grow(ours, "y", 500); at(300, () => show(big2, RISE, 600)); at(700, () => show(parts, FADE, 600)); },
  ];
  addSlide({el, steps, pace: FH.pace, all: [base, solid, range, big1, ours, big2, parts, src]});
}

ID = "four";
/* ================= 13. the four savings ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Time, money, water, crop"});
  const CW = 264, GAP = (1152 - 4 * CW) / 3;
  const items = [
    ["clock", "Time", ["No walking the beds.", "It reads the soil", "every second."]],
    ["coin", "Money", ["$72.94 in parts,", "not $1,200", "for one sensor."]],
    ["drop", "Water", ["Waters when it's dry,", "not on a clock.", "56% less in our replay."]],
    ["sprout", "Crop", ["Catches dry soil", "before the plant dies."]],
  ];
  const cards = items.map(([i, w, ls], k) => {
    const x = k * (CW + GAP);
    return grp(card(x, 20, CW, 420, 20),
      s("circle", {cx: x + CW / 2, cy: 118, r: 58, fill: "rgba(57,135,229,.14)", stroke: BLUE, "stroke-width": 2.6}),
      ico(i, x + CW / 2 - 28, 90, 56, BLUE),
      t(x + CW / 2, 240, w, "font:700 40px var(--f-display);fill:#edf2f7;text-anchor:middle"),
      ...lines(x + CW / 2, 296, ls, 32, {style: "font:400 21px var(--f-body);fill:#b3bec9;text-anchor:middle"}));
  });
  svg.append(...cards);
  const el = frame("", "Farm Hand saves four things", svg);
  addSlide({el, steps: cards.map((c) => () => show(c, RISE, 600)), pace: FH.pace, all: cards});
}

ID = "team";
/* ================= 14. team + credit ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "Team"});
  const T = [["DC", "Dechante Chang", ["Lead", "AI and firmware"]], ["ML", "Matthew Losito", ["Web app"]], ["DL", "Daniel Lopes", ["Hardware", "OLED firmware"]]];
  const CW = 320, GAP = (1152 - 3 * CW) / 2;
  const cards = T.map(([ini, name, roles], i) => {
    const x = i * (CW + GAP), cx = x + CW / 2;
    const g = grp(card(x, 10, CW, 340, 20),
      s("circle", {cx, cy: 104, r: 58, fill: K.surface2, stroke: BLUE, "stroke-width": 3}),
      IMG[ini] ? s("g", {}, s("clipPath", {id: `av-${ini}`}, s("circle", {cx, cy: 104, r: 56})),
        s("image", {href: IMG[ini], x: cx - 56, y: 48, width: 112, height: 112, "clip-path": `url(#av-${ini})`, preserveAspectRatio: "xMidYMid slice"}))
        : t(cx, 105, ini, "font:700 34px var(--f-display);fill:#edf2f7;text-anchor:middle;dominant-baseline:central"),
      t(cx, 212, name, "font:700 25px var(--f-body);fill:#edf2f7;text-anchor:middle"));
    roles.forEach((r, k) => g.append(pill(cx, 256 + k * 50, r, ORANGE, r.length * 8.6 + 36, K.surface2, 38, 16)));
    return g;
  });
  const credit = grp(t(576, 440, FH.site, "font:700 26px var(--f-body);fill:#3987e5;text-anchor:middle"));
  svg.append(...cards, credit);
  const el = frame("", "Who built it", svg);
  addSlide({el, steps: [() => { cards.forEach((c, i) => at(i * 120, () => show(c, RISE, 700))); at(600, () => show(credit, FADE, 600)); }], pace: FH.pace, all: [...cards, credit]});
}

/* ======================= backup slides for judge questions ======================= */

ID = "safety";
/* B1. safety rules */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Safety rules on the board"});
  const R = [["clock", "8 seconds, at most, per drink"], ["hourglass", "5 minutes between drinks"], ["bars", "A daily limit on water"],
    ["drop", "Never when the soil is already wet"], ["x", "Never when a probe is unplugged"]];
  const blocks = R.map(([i, l], k) => block(k < 3 ? 0 : 590, (k % 3) * 84 + 10, 560, 64, "us", i, l));
  const fallback = block(0, 300, 1150, 76, "ext", "shield", "Server unreachable? The board holds the soil at 45% by itself.", "No WiFi, no Mac mini, the plant still gets water.");
  svg.append(...blocks, fallback);
  const el = frame("", "Even if the AI is wrong, the board won't flood or dry out the plant", svg, "These rules run on the board itself.");
  const steps = [() => blocks.forEach((b, k) => at(k * 180, () => show(b, DROP, 700))), () => show(fallback, RISE, 700)];
  addSlide({el, steps, pace: FH.pace, all: [...blocks, fallback]});
}

ID = "bench";
/* B2. bench test */
{
  SEED = 23;
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Bench test: 44% to 52% in one 10-second drink"});
  const A = tote(330, 110, 460, 240);
  const r = readout(560, 400, 44);
  const lab = grp(boxLabel(284, 48, "Farm Hand", BLUE, "box A"));
  const note = quiet(1152, 474, "Bench test, Sep 23, 2026. The pump ran on laptop USB with no restarts.", "end", 15);
  svg.append(A.g, lab, r.g, note);
  const box = A.g;
  const el = frame("", "One 10-second drink: 44% to 52%", svg);
  const steps = [() => { show(box, FADE, 500); show(lab, FADE, 500); show(r.g, FADE, 500); show(note, FADE, 500); },
    () => { pumpRun(A, .55, 700); at(700, () => countTo(r.num, 44, 52, 1500)); }];
  addSlide({el, steps, pace: FH.pace, all: [box, lab, r.g, note], onReset() { A.reset(); r.set(44); }});
}

ID = "croplines";
/* B3. one timer can't fit every crop (FAO-56 stress lines on our 20-65% scale) */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Crop stress lines"});
  const X = (v) => 90 + (v - 20) / 45 * 980;
  const axis = grp(s("path", {d: `M${X(20)},380 H${X(65)}`, stroke: K.axis, "stroke-width": 2}),
    ...[20, 30, 40, 50, 60, 65].map((v) => t(X(v), 412, `${v}%`, "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:middle")),
    t(X(20), 446, "drier", "font:400 17px var(--f-body);fill:#8c98a5"), t(X(65), 446, "wetter", "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:end"));
  const C = [["Sugarcane", 35.8], ["Citrus and blueberries", 42.5], ["Tomatoes", 47], ["Peppers and lettuce", 51.5], ["Strawberries", 56]];
  const marks = C.map(([n, v], i) => {
    const y = 40 + i * 62;
    return grp(s("path", {d: `M${X(v)},${y + 14} V380`, stroke: GREEN, "stroke-width": 2.4, "stroke-dasharray": "5 6"}),
      s("circle", {cx: X(v), cy: y + 8, r: 7, fill: GREEN}),
      t(X(v) + 16, y + 14, `${n}  ${v}%`, `font:700 20px var(--f-body);fill:#edf2f7;${HALO}`));
  });
  svg.append(axis, ...marks);
  const el = frame("", "Every crop needs a different amount of water, so one timer can't fit them all", svg, "Each dot is how dry the soil can get before that crop starts to suffer.");
  addSlide({el, steps: [() => { show(axis, FADE, 400); marks.forEach((m, i) => at(200 + i * 160, () => show(m, RISE, 500))); }], pace: FH.pace, all: [axis, ...marks]});
}

ID = "layamoves";
/* B4. Laya by move */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Decision model accuracy by decision"});
  const R = [["Water now", 3643, 3917], ["Wait, the soil is wet", 3275, 3367], ["Wait, rain is coming", 161, 240]];
  const rows = R.map(([n, a, b], i) => {
    const y = 40 + i * 110, p = a / b, bar = s("rect", {x: 330, y, width: 600 * p, height: 56, rx: 8, fill: i === 2 ? "rgba(57,135,229,.45)" : BLUE});
    return {bar, g: grp(t(310, y + 36, n, "font:700 22px var(--f-body);fill:#edf2f7;text-anchor:end"), s("rect", {x: 330, y, width: 600, height: 56, rx: 8, fill: K.surface2}),
      t(946, y + 26, `${(p * 100).toFixed(1)}%`, "font:700 24px var(--f-body);fill:#edf2f7"),
      t(946, y + 50, `${a.toLocaleString("en-US")} of ${b.toLocaleString("en-US")}`, "font:400 16px var(--f-body);fill:#8c98a5"))};
  });
  const weak = quiet(330, 390, "Rain is its weak spot: only 240 of the 7,524 test cases were rain calls.", "start", 19);
  const gpu = quiet(1152, 470, "Trained on an NVIDIA RTX 4070. Test weather: Miami, Jan 2025 to Sep 2026, never seen in training.", "end", 15);
  rows.forEach((r) => svg.append(r.g, r.bar));
  svg.append(weak, gpu);
  const el = frame("", "The decision model is great at knowing when to water, and weaker at guessing rain", svg);
  const steps = [() => rows.forEach((r, i) => at(i * 250, () => { show(r.g, FADE, 400); grow(r.bar, "x", 900); })), () => { show(weak, RISE, 600); show(gpu, FADE, 600); }];
  addSlide({el, steps, pace: FH.pace, all: [...rows.flatMap((r) => [r.g, r.bar]), weak, gpu]});
}

ID = "real";
/* B5. what's real, what's simulated, what's next */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Real, simulated, next"});
  const COL = [
    ["Real, on the table", GREEN, [["Two boxes with soil and", "temperature probes"], ["The decision model's call,", "live over FIU WiFi"], ["44% to 52% in one", "10-second drink"]]],
    ["Simulated or estimated", K.ink2, [["Season replay: FAO-56", "on real Miami weather"], ["Water used on the boxes:", "estimated from pump time"], ["Farm map: predicted", "from satellite"]]],
    ["Next", K.muted, [["Weatherproof probes", "and longer wire"], ["One board reading many", "probes across a field"], ["Outdoors: wait for rain"]]],
  ];
  const CW = 360, GAP = (1152 - 3 * CW) / 2;
  const cols = COL.map(([h1, c, items], i) => {
    const x = i * (CW + GAP), g = grp(card(x, 10, CW, 420, 20, K.surface, c, i === 2 ? 1.6 : 2.2),
      t(x + 28, 56, h1, `font:700 24px var(--f-body);fill:${c === K.muted ? "#b3bec9" : c}`));
    items.forEach((ls, k) => g.append(s("circle", {cx: x + 34, cy: 112 + k * 104, r: 4.5, fill: c === K.muted ? K.ink2 : c}),
      ...lines(x + 50, 119 + k * 104, ls, 30, {style: "font:400 21px var(--f-body);fill:#edf2f7"})));
    return g;
  });
  svg.append(...cols);
  const el = frame("", "What's real, what's simulated, what's next", svg);
  addSlide({el, steps: cols.map((c) => () => show(c, RISE, 600)), pace: FH.pace, all: cols});
}

ID = "fuel";
/* B6. pumping cost */
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Fuel cost of the water saved"});
  const acreIn = 1992639 / 27154;
  const R = [["$3 diesel", 4.42, GOLD], ["$5 diesel", 7.36, GOLD]];
  const sc = 700 / (acreIn * 7.36);
  const rows = R.map(([n, rate, c], i) => {
    const y = 60 + i * 120, v = acreIn * rate;
    return {bar: s("rect", {x: 250, y, width: v * sc, height: 64, rx: 8, fill: "rgba(57,135,229,.25)", stroke: BLUE, "stroke-width": 2.2}),
      g: grp(t(230, y + 30, n, "font:700 22px var(--f-body);fill:#edf2f7;text-anchor:end"), t(230, y + 56, `$${rate} an acre-inch`, "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:end"),
        t(250 + v * sc + 18, y + 42, `$${Math.round(v)} an acre`, "font:700 26px var(--f-body);fill:#edf2f7"))};
  });
  const how = quiet(250, 340, `2.0 million gallons saved per acre is about ${Math.round(acreIn)} acre-inches of water nobody had to pump.`, "start", 19);
  const src = quiet(1152, 470, "Fuel only, over the 21-month replay. Pumping cost: LSU AgCenter, Southern Ag Today, Jul 2026.", "end", 15);
  rows.forEach((r) => svg.append(r.bar, r.g));
  svg.append(how, src);
  const el = frame("", "The water saved is fuel saved too", svg);
  addSlide({el, steps: [() => rows.forEach((r, i) => at(i * 250, () => { show(r.g, FADE, 400); grow(r.bar, "x", 900); })), () => { show(how, RISE, 600); show(src, FADE, 600); }],
    pace: FH.pace, all: [...rows.flatMap((r) => [r.bar, r.g]), how, src]});
}

/* B7 + B8. demo fallbacks: moisture over time */
function moistureChart(svg) {
  const X0 = 120, X1 = 1060, Y = (v) => 420 - (v - 20) / 45 * 380;
  const g = grp(s("path", {d: `M${X0},${Y(20)} H${X1}`, stroke: K.axis, "stroke-width": 2}),
    ...[20, 40, 60].map((v) => t(X0 - 14, Y(v) + 6, `${v}%`, "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:end")),
    t(X1, Y(20) + 32, "minutes", "font:400 17px var(--f-body);fill:#8c98a5;text-anchor:end"));
  svg.append(g);
  return {g, X0, X1, Y};
}
ID = "target";
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Pick a target, it pulses and locks on"});
  const C = moistureChart(svg);
  const tgt = grp(s("path", {d: `M${C.X0},${C.Y(55)} H${C.X1}`, stroke: BLUE, "stroke-width": 2.2, "stroke-dasharray": "8 8"}),
    t(C.X1, C.Y(55) - 12, "Target 55%", "font:700 20px var(--f-body);fill:#9ec7f5;text-anchor:end"));
  const pts = [[0, 40], [.1, 40], [.14, 44.5], [.26, 44], [.3, 48.5], [.42, 48], [.46, 52], [.56, 51.8], [.6, 54.6], [.7, 55], [1, 54.8]];
  const d = pts.map(([f, v], i) => `${i ? "L" : "M"}${(C.X0 + f * (C.X1 - C.X0)).toFixed(1)},${C.Y(v).toFixed(1)}`).join(" ");
  const ln = s("path", {d, fill: "none", stroke: K.ink, "stroke-width": 3, "stroke-linejoin": "round"});
  const pulses = grp(...[.1, .26, .42, .56].map((f) => s("rect", {x: C.X0 + f * (C.X1 - C.X0), y: 432, width: 30, height: 12, rx: 3, fill: ORANGE})),
    t(C.X0, 470, "pump pulses", "font:400 16px var(--f-body);fill:#d95926"));
  svg.append(tgt, ln, pulses);
  const el = frame("", "Pick a target: it pulses and locks on", svg);
  addSlide({el, steps: [() => { show(C.g, FADE, 400); show(tgt, FADE, 500); }, () => { draw(ln, 2200); show(pulses, FADE, 600); }], pace: FH.pace, all: [C.g, tgt, ln, pulses]});
}
ID = "pinch";
{
  const svg = s("svg", {viewBox: "0 0 1152 480", role: "img", "aria-label": "Pinched tube: the pump ran but the soil didn't rise"});
  const C = moistureChart(svg);
  const d = `M${C.X0},${C.Y(44)} H${C.X0 + 300} L${C.X0 + 380},${C.Y(43.6)} H${C.X1}`;
  const ln = s("path", {d, fill: "none", stroke: K.ink, "stroke-width": 3, "stroke-linejoin": "round"});
  const run = grp(s("rect", {x: C.X0 + 300, y: 432, width: 160, height: 12, rx: 3, fill: ORANGE}), t(C.X0 + 300, 470, "pump running", "font:400 16px var(--f-body);fill:#d95926"));
  const exp = s("path", {d: `M${C.X0 + 300},${C.Y(44)} C${C.X0 + 360},${C.Y(44)} ${C.X0 + 400},${C.Y(52)} ${C.X0 + 480},${C.Y(52)}`, fill: "none", stroke: K.muted, "stroke-width": 2.4, "stroke-dasharray": "6 7"});
  const expLab = t(C.X0 + 490, C.Y(52) + 6, "what a drink should do", "font:400 18px var(--f-body);fill:#8c98a5");
  const alert = badge(C.X0 + 640, C.Y(34), "The pump ran, but the soil didn't rise", "bad", 460);
  svg.append(ln, run, exp, expLab, alert);
  const el = frame("", "Pinch the tube: Farm Hand notices", svg);
  addSlide({el, steps: [() => { show(C.g, FADE, 400); draw(ln, 1600); show(run, FADE, 600); at(900, () => { draw(exp, 700); show(expLab, FADE, 500); }); }, () => show(alert, POP, 600)],
    pace: FH.pace, all: [C.g, ln, run, exp, expLab, alert]});
}

ID = "sources";
/* B9. sources */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "Sources"});
  const S = [
    ["Drought", "US Drought Monitor weekly statistics, Florida and Miami-Dade, checked Sep 23, 2026"],
    ["The nursery", "WINK News, Apr 27, 2026, San Juan Family Nursery (youtu.be/_1h8z__p558)"],
    ["Crop lines", "FAO Irrigation and Drainage Paper 56, Table 22, mapped to our probe scale"],
    ["Sensor prices", "CropX via Roberts Irrigation and IrrigationBox, checked Sep 26, 2026"],
    ["Satellite", "Google DeepMind AlphaEarth Foundations, CC-BY 4.0"],
    ["Season", "Our simulation: FAO-56 water balance on real hourly Miami weather, Jan 2025 to Sep 2026"],
  ];
  const rows = grp(...S.flatMap(([k, v], i) => [t(0, 30 + i * 50, k, "font:700 19px var(--f-body);fill:#edf2f7"), t(190, 30 + i * 50, v, "font:400 19px var(--f-body);fill:#b3bec9")]));
  svg.append(rows);
  const el = frame("", "Sources", svg);
  addSlide({el, steps: [() => show(rows, FADE, 500)], pace: FH.pace, all: [rows]});
}

ID = "drought2";
/* ================= drought, simple: two big numbers ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "80% of Florida in extreme drought; 100% of Miami-Dade still in drought"});
  const big = (x, n, color, l1, l2) => grp(t(x, 230, n, `font:700 150px var(--f-display);fill:${color};text-anchor:middle`),
    t(x, 300, l1, "font:700 28px var(--f-body);fill:#edf2f7;text-anchor:middle"), t(x, 340, l2, "font:400 24px var(--f-body);fill:#b3bec9;text-anchor:middle"));
  const a = big(300, "80%", RED, "of Florida was in extreme drought", "this April");
  const b = big(852, "100%", ORANGE, "of Miami-Dade still in drought", "right now");
  const src = quiet(1152, 490, "US Drought Monitor", "end", 15);
  svg.append(a, b, src);
  const el = frame("", "Florida is so dry that farms are losing crops", svg);
  addSlide({el, steps: [() => { show(a, RISE, 700); show(src, FADE, 500); }, () => show(b, RISE, 700)], pace: FH.pace, all: [a, b, src]});
}

ID = "how2";
/* ================= how it works, simple: three steps ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "Reads the soil, the decision model decides, pump waters"});
  const S = [["drop", "1. Checks the soil", ["Is it wet or dry?", "Every second"], ORANGE],
    ["robot", "2. AI decides", ["Water now, or wait?", "In a tenth of a second"], BLUE],
    ["cup", "3. Waters if dry", ["A small pump", "gives it a drink"], GREEN]];
  const CX = [176, 576, 976];
  const nodes = S.map(([i, h1, ls, c], k) => grp(
    s("circle", {cx: CX[k], cy: 170, r: 96, fill: K.surface, stroke: c, "stroke-width": 3}),
    ico(i, CX[k] - 44, 126, 88, c),
    t(CX[k], 330, h1, "font:700 30px var(--f-body);fill:#edf2f7;text-anchor:middle"),
    ...lines(CX[k], 372, ls, 32, {style: "font:400 22px var(--f-body);fill:#b3bec9;text-anchor:middle"})));
  const links = [0, 1].map((k) => s("path", {d: `M${CX[k] + 112},170 H${CX[k + 1] - 112}`, stroke: K.ink2, "stroke-width": 3, "stroke-linecap": "round"}));
  const heads = [0, 1].map((k) => head(0, 170, CX[k + 1] - 106, 170, K.ink2, 14));
  svg.append(...links, ...heads, ...nodes);
  const dot = dotOf(svg, 9);
  const el = frame("", "Farm Hand checks the soil and only waters when it's dry", svg);
  const hop = (k) => { draw(links[k], 600); travel(links[k], dot, 600, () => { show(heads[k], FADE, 150); show(nodes[k + 1], POP, 600); }); };
  addSlide({el, steps: [() => show(nodes[0], POP, 600), () => hop(0), () => hop(1)], pace: FH.pace, all: [...nodes, ...links, ...heads]});
}

ID = "cost2";
/* ================= cost, simple: two big numbers ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "One farm sensor $1,200; our whole build $72.94"});
  const big = (x, n, color, l1, l2) => grp(t(x, 230, n, `font:700 130px var(--f-display);fill:${color};text-anchor:middle`),
    t(x, 300, l1, "font:700 28px var(--f-body);fill:#edf2f7;text-anchor:middle"), t(x, 340, l2, "font:400 24px var(--f-body);fill:#b3bec9;text-anchor:middle"));
  const a = big(300, "$1,200", GOLD, "for one sensor farms buy today", "plus $309 a year");
  const b = big(852, "$72.94", BLUE, "for all of Farm Hand's parts", "with 5 sensors");
  svg.append(a, b);
  const el = frame("", "Farm Hand costs a tiny fraction of what farms pay now", svg);
  addSlide({el, steps: [() => show(a, RISE, 700), () => show(b, RISE, 700)], pace: FH.pace, all: [a, b]});
}

ID = "sponsors";
/* ================= how we used sponsor tech (final list from Dechante: 5 tiles, 3 + 2) ================= */
{
  const svg = s("svg", {viewBox: "0 0 1152 540", role: "img", "aria-label": "How we used sponsor tech"});
  const T = [
    ["bars", "Google Gemini API", "All our data, one AI", ["Pulls, analyzes and plots our data:", "1,347 farms from satellite, the", "weather, and which crops fit."]],
    ["robot", "Microsoft", "AI in the experience", ["No chat window. It reads the soil", "and waters on its own, with the", "reason on screen."]],
    ["speaker", "ElevenLabs", "Hear your farm", ["One tap on Listen and a voice reads", "each box's moisture, temperature and", "what the model is doing."]],
    ["clock", "Tiger Data", "Readings as time series", ["Tiger Cloud stores every sensor", "reading over time, so live charts", "stay fast."]],
    ["lock", "Assurant", "Private, visible AI", ["Runs on our own machine, so farm", "data never leaves it. Every call shows", "its reason and the water it used."]],
  ];
  const CW = 368, CH = 256, G = (1152 - 3 * CW) / 2;
  const cards = T.map(([i, who, what, ls], k) => {
    const row = k < 3 ? 0 : 1, col = row ? k - 3 : k;
    const x = row ? (1152 - 2 * CW - G) / 2 + col * (CW + G) : col * (CW + G), y = 4 + row * (CH + 22);
    return grp(card(x, y, CW, CH, 18),
      s("circle", {cx: x + 52, cy: y + 52, r: 30, fill: "rgba(57,135,229,.14)", stroke: BLUE, "stroke-width": 2.2}), ico(i, x + 36, y + 36, 32, BLUE),
      t(x + 96, y + 60, who, "font:700 20px var(--f-body);fill:#b3bec9"),
      t(x + 24, y + 122, what, "font:700 26px var(--f-display);fill:#edf2f7"),
      ...lines(x + 24, y + 162, ls, 27, {style: "font:400 18px var(--f-body);fill:#edf2f7"}));
  });
  svg.append(...cards);
  const el = frame("", "How we used our sponsors' tech", svg);
  addSlide({el, steps: cards.map((c) => () => show(c, RISE, 600)), pace: FH.pace, all: cards});
}

ID = "news";
/* ================= the news: 8 real 2026 headlines as clippings (sources: research/farm_hand_florida_facts.md) ================= */
{
  const N = [
    ["USDA Farm Service Agency", "Apr 20, 2026", ["USDA designates 61 counties in", "Florida as natural disaster", "areas due to drought"]],
    ["WCJB", "Mar 27, 2026", ["Florida's worst drought", "in 20 years threatens crops"]],
    ["FreshPlaza", "2026", ["Florida growers face US$3.1B", "in weather-related crop losses"]],
    ["WUFT", "Mar 11, 2026", ["North Florida drought strains", "farmers as dry conditions persist"]],
    ["WCJB", "Apr 5, 2026", ["Local drought intensifies into", "level 4 of 4: 'exceptional'"]],
    ["SW Florida Water Mgmt. District", "Jun 23, 2026", ["District extends Modified", "Phase III water shortage"]],
    ["Citrus Industry", "Jun 25, 2026", ["Drought impacting", "irrigation needs"]],
    ["Independent Florida Alligator", "Jun 2026", ["Farmers, local agriculture experts", "reflect on drought impacts"]],
  ];
  const svg = s("svg", {viewBox: "0 0 1152 540", role: "img", "aria-label": "News headlines about the 2026 Florida drought"});
  const W = 364, H = 150, POS = [[0, 6], [394, 18], [788, 0], [16, 190], [402, 180], [788, 194], [150, 370], [560, 378]], TILT = [-1.6, 1.1, -0.8, 1.4, -1.2, 0.9, -0.7, 1.3];
  const cards = N.map(([src, date, head], k) => {
    const [x, y] = POS[k];
    const inner = s("g", {transform: `rotate(${TILT[k]} ${x + W / 2} ${y + H / 2})`},
      s("rect", {x: x + 4, y: y + 6, width: W, height: H, rx: 4, fill: "rgba(0,0,0,.45)"}),
      s("rect", {x, y, width: W, height: H, rx: 4, fill: "#f2efe6"}),
      t(x + 20, y + 30, src, "font:700 13px var(--f-body);fill:#2b2b2b"),
      t(x + W - 20, y + 30, date, "font:400 13px var(--f-body);fill:#555;text-anchor:end"),
      s("path", {d: `M${x + 20},${y + 42} H${x + W - 20}`, stroke: "#2b2b2b", "stroke-width": 1.4}),
      ...lines(x + 20, y + 72, head, 26, {style: "font:700 19px Georgia,'Times New Roman',serif;fill:#141414"}));
    return grp(inner);
  });
  svg.append(...cards);
  const el = frame("", "The news this year: Florida's farms are drying out", svg);
  const land = (from, to) => cards.slice(from, to).forEach((c, i) => at(i * 220, () => show(c, DROP, 700)));
  addSlide({el, steps: [() => land(0, 4), () => land(4, 8)], pace: FH.pace, all: cards});
}

ID = "newssources";
/* ================= backup: where each headline comes from ================= */
{
  const S = [
    ["USDA FSA, Apr 20 2026", "fsa.usda.gov/news-events/news/04-20-2026/usda-designates-61-counties-florida-primary-natural-disaster-areas-due"],
    ["WCJB, Mar 27 2026", "wcjb.com/2026/03/27/floridas-worst-drought-20-years-threatens-crops/"],
    ["FreshPlaza", "freshplaza.com/north-america/article/9840689/florida-growers-face-us-3-1b-in-weather-related-crop-losses/"],
    ["WUFT, Mar 11 2026", "wuft.org/2026-03-11/north-florida-drought-strains-farmers-as-dry-conditions-persist"],
    ["WCJB, Apr 5 2026", "wcjb.com/2026/04/05/local-drought-intensifies-into-level-4-4-exceptional/"],
    ["SWFWMD, Jun 23 2026", "swfwmd.state.fl.us/the-newsroom/2026/district-extends-modified-phase-iii-water-shortage"],
    ["Citrus Industry, Jun 25 2026", "citrusindustry.net/2026/06/25/drought-impacting-irrigation-needs/"],
    ["Florida Alligator, Jun 2026", "alligator.org/article/2026/06/agriculture-drought-impacts"],
  ];
  const svg = s("svg", {viewBox: "0 0 1152 500", role: "img", "aria-label": "News sources"});
  const rows = grp(...S.flatMap(([k, v], i) => [t(0, 30 + i * 56, k, "font:700 19px var(--f-body);fill:#edf2f7"), t(0, 54 + i * 56, v, "font:400 16px var(--f-body);fill:#b3bec9")]));
  svg.append(rows);
  const el = frame("", "Where the headlines come from", svg);
  addSlide({el, steps: [() => show(rows, FADE, 500)], pace: FH.pace, all: [rows]});
}

/* ================= running order =================
   Main pitch first, then backups for judge questions. Anything not listed is left out. */
const ORDER = ["title", "news", "hook", "drought2", "how2", "results", "season", "cost2", "sponsors", "map",
  /* backups */ "cup", "how", "laya", "crops", "fieldcrops", "drought", "safety", "layamoves", "croplines", "sources", "newssources"];
{
  const keep = ORDER.map((id) => SLIDES.find((sl) => sl.id === id)).filter(Boolean);
  SLIDES.length = 0; SLIDES.push(...keep);
}
