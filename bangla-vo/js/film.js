// বন্দি সবুজ দানা — The Green Prisoner (Breaking Biology). The whole film as data: every chalk stroke with its time,
// the sliding front panel, the one wipe, the camera, the board texts for readcheck, the subtitles and the sound events.
// Units: world = the board's slate (x 0…6400, y 0…1700). Front-panel things (layer 'FL') are panel-local and move
// with slideX(t); back-board things (layer 'BK') are in world units and are seen once the panel has slid away.
// The picture is timed to the owner's voice recording (src/voiceover.wav), which starts at VO0.
import { clamp, lerp, eio } from '/core/lib.js';
import { Stroke, catmull, rng } from './chalk.js';
import { writeBn, writeBnC } from './bn.js';
import { PW } from './stage.js';

export const VO0 = .5;                                   // the voice starts here (film seconds)
// spoken segments of the recording (audio seconds, from silencedetect) and their subtitles (Bangla only)
export const LINES = [
  [0.00, 2.28, '১৮৮৩ সাল। জার্মানি।'],
  [3.07, 5.83, 'এক তরুণ উদ্ভিদবিজ্ঞানী আন্দ্রিয়াস শিম্পার'],
  [6.20, 7.34, 'চোখ রাখলেন মাইক্রোস্কোপে।'],
  [8.26, 10.16, 'কোষের ভেতরে ছোট ছোট সবুজ দানা।'],
  [10.84, 12.87, 'সবাই ভাবত, কোষ নিজেই এগুলো বানায়।'],
  [14.86, 16.47, 'কিন্তু শিম্পার দেখলেন অন্য কিছু।'],
  [17.53, 19.15, 'দানাগুলো নিজেরাই ভাগ হচ্ছে,'],
  [20.04, 21.34, 'ঠিক যেন জীবন্ত কোনো প্রাণী।'],
  [22.48, 24.34, 'তিনি এদের নাম দিলেন ক্লোরোপ্লাস্ট।'],
  [25.25, 28.09, 'আর ছোট্ট একটা নোটে লিখলেন এক অবিশ্বাস্য সন্দেহ—'],
  [29.11, 30.77, 'হয়তো এরা একসময় ছিল আলাদা,'],
  [31.20, 31.99, 'স্বাধীন জীব।'],
  [33.34, 35.23, 'কয়েক দশক পর বিজ্ঞান বলল, তিনি ঠিক ছিলেন।'],
  [36.09, 38.30, 'কোটি কোটি বছর আগে এক ক্ষুদ্র ব্যাকটেরিয়া'],     // owner's choice: no number in the subtitle
  [38.30, 39.81, 'ঢুকে পড়েছিল এক কোষে,'],
  [40.70, 41.64, 'আর কখনো বের হয়নি।'],
  [42.61, 44.89, 'সেই বন্দি আজ সূর্যের আলো দিয়ে খাবার বানায়,'],
  [45.36, 46.42, 'পুরো পৃথিবীর জন্য।'],
  [47.72, 49.23, 'বিজ্ঞান মুখস্থ করার জিনিস না।'],
  [50.08, 51.07, 'এটা একটা গল্প।'],
];
export const VO_LEN = 51.07;
// reading time of a board text (Bangla counted like Latin: letters ÷ 15 + 1.5 s)
export const needOf = txt => Math.max(1.5, [...txt].filter(c => !/\s/.test(c)).length / 15 + 1.5);

export function build(W = 1920, H = 1080) {
  const S = [], TX = [], EV = [], SUBS = [], T = {};
  const v = a => a + VO0;                                 // audio time → film time
  const add = (arr, layer, phase = 'pre') => { arr.forEach(s => { s.layer = layer; s.phase = phase; S.push(s); }); return arr; };
  const text = (id, txt, layer, st, t1 = 1e9, pad = 8) => { const b = st.box; TX.push({ id, text: txt, layer, box: [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], t0: st[0].t0, t1 }); };
  // a drawn line (white unless o.color), smooth through its points when o.smooth
  const ln = (pts, t0, dur, o = {}) => { const s = new Stroke(o.smooth ? catmull(pts, 10) : pts, { kind: 'write', w: 9, taper: .18, taperLen: .2, land: .6, skip: .14, endSpecks: true, specks: .6, wob: 1.4, ...o }); s.t0 = t0; s.t1 = t0 + dur; return s; };
  // an ellipse drawn as one stroke that overlaps its start a little (a hand closing a circle)
  const ell = (cx, cy, rx, ry, t0, dur, o = {}) => {
    const rot = o.rot ?? 0, a0 = o.a0 ?? -2.2, a1 = o.a1 ?? a0 + Math.PI * 2 + .22, n = Math.max(16, Math.ceil((rx + ry) * Math.abs(a1 - a0) / 14)), R = rng(o.seed ?? 7), p = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n), k = 1 + (R() - .5) * .012, x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return ln(p, t0, dur, { wav: 260, ...o });
  };
  const arrow = (a, b, t0, o = {}) => {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = o.head ?? 34;
    return [ln([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6], b], t0, .22, { smooth: true, ...o }),
            ln([[b[0] + Math.cos(ang + 2.6) * L, b[1] + Math.sin(ang + 2.6) * L], b, [b[0] + Math.cos(ang - 2.6) * L, b[1] + Math.sin(ang - 2.6) * L]], t0 + .24, .12, { taper: .1, ...o })];
  };
  // a chloroplast / bacterium grain in the accent chalk: an oval and the line of its inner membranes
  const grain = (cx, cy, rx, ry, rot, t0, o = {}) => {
    const c = Math.cos(rot), s = Math.sin(rot), P = (u, w) => [cx + u * c - w * s, cy + u * s + w * c];
    return [ell(cx, cy, rx, ry, t0, .18, { rot, color: 'green', w: o.w ?? 7, seed: o.seed }),
            ln([P(-rx * .55, ry * .05), P(-rx * .15, -ry * .25), P(rx * .2, ry * .2), P(rx * .55, -ry * .05)], t0 + .19, .1, { smooth: true, color: 'green', w: (o.w ?? 7) * .7 })];
  };

  // ───────── subtitles: one Bangla line per spoken segment, held ≥ 1.8 s and ≥ the line + 0.6 s
  LINES.forEach(([a, b, bn], i) => {
    const t0 = v(a) - .08, nx = LINES[i + 1] ? v(LINES[i + 1][0]) - .1 : 1e9;
    const t1 = Math.min(nx, Math.max(v(b) + .3, t0 + 1.8, v(b) - v(a) + .6 + t0));
    SUBS.push({ id: 's' + (i + 1), t0, t1, bn });
    EV.push({ t: +t0.toFixed(3), type: 'sub', t1: +t1.toFixed(3), bn });
  });
  EV.push({ t: VO0, type: 'vo', id: 'voiceover' });

  // ───────── S1 · 1883, Germany (hook: the year is being written from the first frames)
  const year = add(writeBn('year', 170, 330, 280, .12, { speed: 6.5, seed: 1 }), 'FL');
  text('year', '১৮৮৩', 'FL', year);
  const ger = add(writeBn('germany', 800, 372, 120, v(1.84) - .3, { speed: 13, seed: 2 }), 'FL');
  text('germany', 'জার্মানি', 'FL', ger);

  // ───────── S2 · the microscope (drawn as the young botanist is named), his name, the line to what he sees
  const MK = .81, MX = 66, MY = 124, M = ([x, y]) => [MX + x * MK, MY + y * MK];
  const mic = (pts, t0, d, o = {}) => ln(pts.map(M), t0, d, { w: 10, ...o });
  let t = v(3.1);
  const micro = [
    mic([[380, 1420], [740, 1420], [775, 1490], [345, 1490], [380, 1420]], t, .4),                 // base
    mic([[690, 1420], [722, 1250], [705, 1080], [640, 905]], t + .45, .3, { smooth: true }),       // arm
    mic([[640, 1420], [668, 1250], [652, 1092], [598, 940]], t + .78, .28, { smooth: true }),
    mic([[395, 1185], [770, 1185]], t + 1.1, .2, { w: 12 }),                                       // stage
    mic([[525, 1092], [432, 722]], t + 1.35, .22),                                                 // tube
    mic([[592, 1075], [500, 705]], t + 1.6, .22),
    mic([[420, 712], [405, 642], [492, 620], [508, 690]], t + 1.86, .26),                         // eyepiece
    mic([[536, 1086], [546, 1140], [577, 1135], [586, 1080]], t + 2.16, .2),                      // objective
    ln(catmull([...Array(14)].map((_, i) => { const a = i / 13 * 6.5; return M([690 + Math.cos(a) * 40, 1000 + Math.sin(a) * 40]); }), 4), t + 2.4, .22, { w: 9 }),  // focus knob
    mic([[505, 1320], [560, 1302], [615, 1320], [560, 1338], [505, 1320]], t + 2.66, .2, { smooth: true }),   // mirror
    mic([[470, 1172], [650, 1172]], t + 2.9, .14, { w: 7 }),                                       // slide on the stage
  ];
  add(micro, 'FL');
  add(grain(...M([560, 1160]), 13, 8, .1, t + 3.06, { w: 5 }), 'FL');                           // the sample: the green begins here
  const name = add(writeBn('schimper', 640, 610, 120, v(4.9), { speed: 12, seed: 3 }), 'FL');
  text('schimper', 'শিম্পার', 'FL', name);
  // the line that sews the eyepiece to the view: what he sees is drawn next to the microscope
  const VC = [1460, 760], VR = 400;
  add([ln([M([470, 610]), [700, 470], [900, 430], [1120, 470]], v(7.0), .34, { smooth: true, w: 7, taper: .05 })], 'FL');
  add([ell(VC[0], VC[1], VR, VR, v(7.3), .55, { w: 11, seed: 11, a0: -2.6 })], 'FL');
  // the plant cell inside the view: wall (double line), nucleus
  t = v(7.95);
  const cellR = [[1190, 520], [1730, 520], [1730, 1000], [1190, 1000]];
  const rrect = (x0, y0, x1, y1, r) => { const p = []; const c = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
    for (const [cx, cy, a] of c) for (let k = 0; k <= 6; k++) { const q = a + k / 6 * Math.PI / 2; p.push([cx + Math.cos(q) * r, cy + Math.sin(q) * r]); } p.push(p[0].slice()); p.push([p[1][0], p[1][1]]); return p; };
  add([ln(rrect(1190, 520, 1730, 1000, 60), t, .5, { w: 9, wav: 300 }), ln(rrect(1212, 542, 1708, 978, 44), t + .52, .4, { w: 6, wav: 300 })], 'FL');
  add([ell(1600, 690, 64, 58, t + .95, .22, { w: 8, seed: 5 }), ell(1612, 682, 16, 14, t + 1.18, .08, { w: 7, seed: 6 })], 'FL');
  // the green grains, each born as the voice says "সবুজ দানা" (marimba ticks in the score)
  const GR = [[1290, 640, .3], [1405, 600, -.4], [1300, 880, .8], [1440, 930, -.1], [1560, 860, .5], [1660, 920, -.6], [1385, 760, .1], [1655, 590, .9]];
  T.grains = [];
  GR.forEach(([x, y, r], i) => { const g0 = v(9.25) + i * .13; T.grains.push(g0); add(grain(x, y, 34, 19, r, g0, { seed: 20 + i }), 'FL'); });
  EV.push(...T.grains.map(g => ({ t: +g.toFixed(3), type: 'grain' })));

  // ───────── S3 · the belief, written under the view
  const belief = add(writeBnC('belief', VC[0], 1255, 105, v(10.6), { speed: 18, seed: 4 }), 'FL');
  text('belief', 'কোষ নিজেই বানায়?', 'FL', belief, v(14.0));
  belief.forEach(s => s.wiped = true);

  // ───────── S4 · the turn: one wipe in the held silence, the truth rewritten in the same place
  T.wipe0 = v(13.85); T.wipe1 = T.wipe0 + .7;
  EV.push({ t: T.wipe0, type: 'wipe', d: .7 });
  const WP = [[1000, 1265], [1180, 1240], [1380, 1275], [1560, 1245], [1760, 1270], [1930, 1250]];
  const wipe = { t0: T.wipe0, t1: T.wipe1, w: 150, path: catmull(WP, 12) };
  const divide = add(writeBnC('divide', VC[0], 1255, 105, v(17.6), { speed: 12, seed: 5 }), 'FL', 'post');
  text('divide', 'নিজেরাই ভাগ হয়!', 'FL', divide);
  // grains dividing: a twin drawn hard against three grains, with two little white marks of motion
  const twin = (i, t0) => { const [x, y, r] = GR[i], c = Math.cos(r), s = Math.sin(r);
    return [...grain(x + c * 58, y + s * 58, 30, 18, r, t0, { seed: 40 + i }),
      ln([[x - 46 * s - 18 * c, y + 46 * c - 18 * s], [x - 50 * s, y + 50 * c], [x - 46 * s + 18 * c, y + 46 * c + 18 * s]], t0 + .3, .12, { w: 5, smooth: true }),
      ln([[x + 46 * s - 18 * c, y - 46 * c - 18 * s], [x + 50 * s, y - 50 * c], [x + 46 * s + 18 * c, y - 46 * c + 18 * s]], t0 + .44, .12, { w: 5, smooth: true })]; };
  add(twin(4, v(18.2)), 'FL', 'post'); EV.push({ t: v(18.2), type: 'grain' });
  add(twin(0, v(20.1)), 'FL', 'post'); EV.push({ t: v(20.1), type: 'grain' });
  add(twin(3, v(20.75)), 'FL', 'post'); EV.push({ t: v(20.75), type: 'grain' });

  // ───────── S5 · the name: a white line from a grain to the word ক্লোরোপ্লাস্ট
  add([ln([[1700, 575], [1880, 470], [2080, 430]], v(22.55), .3, { smooth: true, w: 7, taper: .05 })], 'FL', 'post');
  const chl = add(writeBn('chloro', 2120, 420, 170, v(22.9), { speed: 11, seed: 6 }), 'FL', 'post');
  text('chloro', 'ক্লোরোপ্লাস্ট', 'FL', chl);
  EV.push({ t: chl.end, type: 'tap', big: 1 });

  // ───────── S6 · Schimper's note: the second hand (pale yellow), a paper-like box with a folded corner
  t = v(25.6);
  const NB = [2090, 640, 3060, 1170];
  add([ln([[NB[0], NB[1]], [NB[2] - 70, NB[1]], [NB[2], NB[1] + 70], [NB[2], NB[3]], [NB[0], NB[3]], [NB[0], NB[1] + 4]], t, .75, { color: 'kid', w: 7, wob: 2.5 }),
       ln([[NB[2] - 70, NB[1]], [NB[2] - 66, NB[1] + 66], [NB[2], NB[1] + 70]], t + .78, .2, { color: 'kid', w: 6 })], 'FL', 'post');
  const n1 = add(writeBnC('note1', (NB[0] + NB[2]) / 2, 815, 95, v(27.4), { speed: 14, seed: 7, color: 'kid' }), 'FL', 'post');
  const n2 = add(writeBnC('note2', (NB[0] + NB[2]) / 2, 1010, 95, Math.max(v(29.5), n1.end + .1), { speed: 14, seed: 8, color: 'kid' }), 'FL', 'post');
  text('note1', 'হয়তো একসময়', 'FL', n1); text('note2', 'স্বাধীন জীব?', 'FL', n2);

  // ───────── S7 · decades later: the front panel slides away (its roll starts in the silence), the back board
  T.slide0 = v(33.05); T.slide1 = T.slide0 + 1.15;
  EV.push({ t: T.slide0, type: 'slide', d: 1.15 });
  const dec = add(writeBn('decades', 170, 250, 140, v(33.65), { speed: 16, seed: 9 }), 'BK');
  text('decades', 'কয়েক দশক পর', 'BK', dec);
  const tick = add([ln([[975, 240], [1020, 300], [1120, 158]], Math.max(v(34.95), dec.end + .1), .26, { w: 11, taper: .2 })], 'BK');
  EV.push({ t: tick[0].t1, type: 'tap', big: 1 });

  // ───────── S8 · the answer: a free bacterium enters a cell and never leaves; it feeds on sunlight
  t = v(36.15);
  const BX = [420, 760];
  const bact = [ln(catmull([[BX[0] - 80, BX[1] - 30], [BX[0] + 60, BX[1] - 42], [BX[0] + 98, BX[1] - 4], [BX[0] + 72, BX[1] + 36], [BX[0] - 70, BX[1] + 40], [BX[0] - 102, BX[1] + 4], [BX[0] - 80, BX[1] - 30], [BX[0] - 40, BX[1] - 36]], 8), t, .4, { color: 'green', w: 9 }),
    ln([[BX[0] - 40, BX[1] - 2], [BX[0] - 5, BX[1] - 14], [BX[0] + 30, BX[1] + 8], [BX[0] + 60, BX[1] - 6]], t + .42, .14, { smooth: true, color: 'green', w: 6 }),
    ln([[BX[0] - 102, BX[1] + 6], [BX[0] - 140, BX[1] - 20], [BX[0] - 175, BX[1] + 18], [BX[0] - 210, BX[1] - 16], [BX[0] - 245, BX[1] + 10]], t + .58, .28, { smooth: true, color: 'green', w: 6 })];
  add(bact, 'BK');
  const bLab = add(writeBnC('bacteria', BX[0], 965, 85, v(37.1), { speed: 13, seed: 10 }), 'BK');
  text('bacteria', 'ব্যাকটেরিয়া', 'BK', bLab);
  add(arrow([600, 770], [880, 780], v(38.2), { w: 9 }), 'BK');
  // the host cell, open on its left; the bacterium inside; the gap closed behind it
  const HC = [1260, 780], HR = 300;
  add([ell(HC[0], HC[1], HR, HR * .92, v(38.6), .6, { a0: Math.PI + .38, a1: Math.PI * 3 - .38, w: 11, seed: 12 }), ell(1360, 690, 58, 52, v(39.25), .2, { w: 8, seed: 13 })], 'BK');
  const IN = [1130, 820];
  add([ln(catmull([[IN[0] - 60, IN[1] - 24], [IN[0] + 48, IN[1] - 32], [IN[0] + 76, IN[1] - 2], [IN[0] + 54, IN[1] + 28], [IN[0] - 56, IN[1] + 30], [IN[0] - 80, IN[1] + 2], [IN[0] - 60, IN[1] - 24], [IN[0] - 30, IN[1] - 28]], 8), v(39.5), .34, { color: 'green', w: 9 }),
       ln([[IN[0] - 30, IN[1]], [IN[0], IN[1] - 10], [IN[0] + 26, IN[1] + 6], [IN[0] + 48, IN[1] - 4]], v(39.86), .12, { smooth: true, color: 'green', w: 6 })], 'BK');
  EV.push({ t: v(39.5), type: 'grain' });
  add([ell(HC[0], HC[1], HR, HR * .92, v(40.75), .3, { a0: Math.PI - .42, a1: Math.PI + .42, w: 11, seed: 14, taper: .05 })], 'BK');
  EV.push({ t: v(41.05), type: 'shut' });
  const pris = add(writeBnC('prisoner', HC[0], 1140, 110, v(41.2), { speed: 12, seed: 11 }), 'BK');
  text('prisoner', 'বন্দি', 'BK', pris);
  // sun → leaf (its own green grains) → আলো → খাবার; then the world
  t = v(42.65);
  const SC = [1880, 430], SR0 = 92;
  add([ell(SC[0], SC[1], SR0, SR0, t, .32, { w: 10, seed: 15 })], 'BK');
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - .2, r0 = SR0 + 28, r1 = SR0 + 78; add([ln([[SC[0] + Math.cos(a) * r0, SC[1] + Math.sin(a) * r0], [SC[0] + Math.cos(a) * r1, SC[1] + Math.sin(a) * r1]], t + .34 + i * .055, .07, { w: 8 })], 'BK'); }
  EV.push({ t: t + .34, type: 'rays' });
  const LC = [2250, 740];
  add([ln(catmull([[LC[0] - 190, LC[1] + 60], [LC[0] - 60, LC[1] - 70], [LC[0] + 120, LC[1] - 90], [LC[0] + 200, LC[1] - 60], [LC[0] + 130, LC[1] + 60], [LC[0] - 40, LC[1] + 110], [LC[0] - 190, LC[1] + 60]], 8), t + .9, .5, { w: 9 }),
       ln([[LC[0] - 230, LC[1] + 95], [LC[0] - 60, LC[1] + 20], [LC[0] + 80, LC[1] - 30], [LC[0] + 180, LC[1] - 58]], t + 1.42, .22, { smooth: true, w: 7 })], 'BK');
  [[2120, 720, .2], [2230, 680, -.3], [2330, 720, .4], [2200, 790, -.2], [2080, 790, .5]].forEach(([x, y, r], i) => add(grain(x, y, 22, 12, r, t + 1.68 + i * .08, { w: 5, seed: 60 + i }), 'BK'));
  const alo = add(writeBn('light', 1770, 985, 95, v(43.6), { speed: 14, seed: 12 }), 'BK');
  add(arrow([1990, 985], [2110, 985], alo.end + .03, { w: 8, head: 26 }), 'BK');
  const food = add(writeBn('food', 2140, 985, 95, alo.end + .45, { speed: 14, seed: 13 }), 'BK');
  text('light', 'আলো', 'BK', alo); text('food', 'খাবার', 'BK', food);
  // the globe
  t = v(45.4);
  const GC = [2800, 700], GRd = 185;
  add([ell(GC[0], GC[1], GRd, GRd, t, .4, { w: 10, seed: 16 }),
       ell(GC[0], GC[1], GRd * .45, GRd, t + .42, .26, { w: 6, seed: 17 }),
       ln([[GC[0] - GRd, GC[1]], [GC[0], GC[1] + 14], [GC[0] + GRd, GC[1]]], t + .7, .16, { smooth: true, w: 6 }),
       ln([[GC[0] - GRd * .82, GC[1] - 88], [GC[0], GC[1] - 76], [GC[0] + GRd * .82, GC[1] - 88]], t + .88, .14, { smooth: true, w: 5 }),
       ln([[GC[0] - GRd * .82, GC[1] + 92], [GC[0], GC[1] + 104], [GC[0] + GRd * .82, GC[1] + 92]], t + 1.03, .14, { smooth: true, w: 5 })], 'BK');
  // tiny leaves on the globe in the accent: what the prisoner feeds
  [[2730, 640, .3], [2860, 760, -.4], [2760, 790, .6], [2880, 620, -.2]].forEach(([x, y, r], i) => add(grain(x, y, 16, 9, r, t + 1.2 + i * .07, { w: 4, seed: 70 + i }), 'BK'));

  // ───────── S9 · the verdict: মুখস্থ নয় — গল্প, then the whole classroom wall
  const rote = add(writeBn('notrote', 560, 1440, 140, v(47.85), { speed: 12, seed: 14 }), 'BK');
  text('notrote', 'মুখস্থ নয়', 'BK', rote);
  add([ln([[1010, 1446], [1110, 1440]], v(49.75), .14, { w: 10 })], 'BK');
  const story = add(writeBn('story', 1160, 1430, 210, v(50.0), { speed: 9, seed: 15 }), 'BK');
  text('story', 'গল্প', 'BK', story);
  add([ln([[1150, 1568], [1270, 1562], [1395, 1552]], story.end + .1, .26, { smooth: true, w: 11 })], 'BK');
  EV.push({ t: story.end + .36, type: 'tap', big: 1 });
  T.wide0 = v(51.15); T.wide1 = T.wide0 + 1.0; T.push0 = T.wide1 + 1.0; T.push1 = T.push0 + .9;
  EV.push({ t: T.wide0 + .4, type: 'bell' }, { t: T.push0, type: 'push', d: .9 });

  // ───────── S10 · end card on the back board's clean corner: Breaking Biology, a green grain, the tag line
  const ECX = 2500;
  const brand = add(writeBnC('brand', ECX, 1318, 118, T.push1 - .15, { speed: 22, seed: 16 }), 'BK');
  text('brand', 'Breaking Biology', 'BK', brand);
  T.dot = brand.end + .15;
  add(grain(ECX, 1445, 40, 22, -.15, T.dot, { w: 8, seed: 90 }), 'BK');
  EV.push({ t: T.dot, type: 'ding' });
  const tag = add(writeBnC('tag', ECX, 1570, 82, T.dot + .4, { speed: 18, seed: 17 }), 'BK');
  text('tag', 'বিজ্ঞান = গল্প', 'BK', tag);
  for (const [k, g] of Object.entries({ year, ger, name, belief, divide, chl, n1, n2, dec, bLab, pris, alo, food, rote, story, brand, tag })) T['end_' + k] = [g[0].t0, g.end];
  T.DUR = +Math.max(tag[0].t0 + needOf('বিজ্ঞান = গল্প') + .6, brand[0].t0 + needOf('Breaking Biology') + .8, v(VO_LEN) + 1).toFixed(2);

  // ───────── the sliding front panel: away at S7, never back
  const slideX = tt => PW * eio(clamp((tt - T.slide0) / (T.slide1 - T.slide0)));

  // ───────── camera: keys [t, cx, cy, s] (world units, s for a 1920-wide frame), eased; each shot its own keys
  const shots = [
    { t0: 0, keys: [[0, 640, 380, 1.45], [v(2.6), 660, 385, 1.43], [v(4.1), 800, 878, .9], [v(6.9), 805, 876, .9], [v(8.1), VC[0], 895, .9], [v(13.4), VC[0] + 6, 899, .92]] },
    { t0: v(13.4) + .001, keys: [[v(13.4), VC[0] + 6, 899, .92], [v(21.95), VC[0] + 8, 900, .925], [v(22.85), 2300, 560, 1.12], [v(25.0), 2310, 565, 1.125], [v(25.8), 1985, 830, .665], [v(32.45), 1990, 832, .67], [v(33.1), 1600, 850, .58], [v(35.85), 1600, 852, .582]] },
    { t0: v(35.9), keys: [[v(35.9), 1000, 845, 1.0], [v(42.35), 1010, 842, 1.0], [v(43.35), 2160, 770, 1.0], [v(47.1), 2165, 772, 1.0]] },
    { t0: v(47.15), keys: [[v(47.15), 1080, 1250, 1.0], [T.wide0, 1095, 1250, 1.0], [T.wide1, 3200, 860, .284], [T.push0, 3200, 862, .285], [T.push1, ECX, 1455, 1.25], [T.DUR, ECX, 1457, 1.26]] },
  ];
  shots.forEach((s, i) => s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : 1e9);
  const camAt = tt => {
    let i = 0; while (i + 1 < shots.length && tt >= shots[i + 1].t0) i++;
    const K = shots[i].keys; let k = 0; while (k + 1 < K.length - 1 && tt > K[k + 1][0]) k++;
    const a = K[k], b = K[Math.min(K.length - 1, k + 1)], u = b[0] > a[0] ? eio(clamp((tt - a[0]) / (b[0] - a[0]))) : 1;
    // scale is eased in log space so a big zoom (wide ↔ close) feels even
    return { cx: lerp(a[1], b[1], u), cy: lerp(a[2], b[2], u), s: Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u)), shot: i };
  };

  // chalk events for the sound: every stroke on screen, with its length, colour and pan
  for (const st of S) {
    if (st.t1 <= 0 || st.t0 >= T.DUR) continue;
    const c = camAt((st.t0 + st.t1) / 2), p = st.at(st.len / 2), x = p[0] + (st.layer === 'FL' ? slideX(st.t0) : 0);
    const sx = (x - c.cx) * c.s / W * 2;
    if (Math.abs(sx) > 1.3) continue;
    EV.push({ t: +st.t0.toFixed(3), type: 'chalk', d: +(st.t1 - st.t0).toFixed(3), len: Math.round(st.len * c.s), color: st.color, pan: +clamp(sx * .6, -.7, .7).toFixed(2), big: st.w > 12 ? 1 : 0 });
  }
  EV.sort((a, b) => a.t - b.t);
  return { S, TX, EV, SUBS, T, wipe, slideX, camAt, shots, DUR: T.DUR };
}
