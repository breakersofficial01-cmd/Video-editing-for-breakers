// Bangla (and Latin) chalk writing from the centre lines traced by tools/trace.py (js/glyphs.js).
// Every function returns Stroke[] with t0/t1 set, `.end` = when the last stroke lifts, and `.box` = [x0,y0,x1,y1].
// Word by word, left to right; each word's মাত্রা (headline) is drawn in one swoop after its letters.
import { clamp } from '/core/lib.js';
import { Stroke, catmull } from './chalk.js';
import { GLYPHS } from './glyphs.js';

// id: a key of GLYPHS; x: left edge; cy: the letters' visual centre (board units); size: font size in units.
// o: { color, speed (size units / s, default 9), gap (s between strokes), seed, w (chalk half width as a
//      fraction of size), wordGap (s pause between words) }
export function writeBn(id, x, cy, size, clock, o = {}) {
  const g = GLYPHS[id]; if (!g) throw new Error('no traced text ' + id);
  const out = []; let t = clock, word = 0;
  const spd = (o.speed ?? 9) * size, wu = size * (o.w ?? Math.max(g.half * .78, size < 110 ? .05 : .042));
  g.strokes.forEach((s, i) => {
    let P = s.pts.map(([u, v]) => [x + u * size, cy + v * size]);
    if (s.matra && P.length >= 2) {                     // the headline: one slightly rising swoop, a little overshoot
      const a = P[0], b = P[P.length - 1], L = b[0] - a[0];
      P = P.map(([px, py]) => [px, py - (px - a[0]) / (L || 1) * size * .012]);
      P.unshift([a[0] - size * .03, a[1] + size * .004]); P.push([b[0] + size * .025, b[1] - size * .014]);
    }
    if (P.length > 2) P = catmull(P, 4);
    const st = new Stroke(P, {
      kind: 'write', w: wu, color: o.color || 'white', taper: s.matra ? .25 : .14, taperLen: .2, land: .55,
      wob: size * .004, wav: size * .9, skip: .12, press: o.press ?? 1.05, endSpecks: true, specks: .5,
      seed: (o.seed ?? 3) * 37 + i * 5.3, R: o.R,
    });
    const d = clamp(.01 + st.len / spd, .018, s.matra ? .3 : .26);   // traced letters come in several strokes: keep each one quick
    if (out.length) {
      const pe = out[out.length - 1].end;
      t += (o.gap ?? .005) + Math.hypot(st.start[0] - pe[0], st.start[1] - pe[1]) / (spd * 6);
      if (s.word !== word) t += o.wordGap ?? .05;
    }
    word = s.word;
    st.t0 = t; st.t1 = t + d; t += d; out.push(st);
  });
  out.end = t;
  out.box = [x, cy + g.top * size, x + g.w * size, cy + g.bot * size];
  return out;
}
export const bnWidth = (id, size) => GLYPHS[id].w * size;
// centred on cx
export const writeBnC = (id, cx, cy, size, clock, o = {}) => writeBn(id, cx - bnWidth(id, size) / 2, cy, size, clock, o);
