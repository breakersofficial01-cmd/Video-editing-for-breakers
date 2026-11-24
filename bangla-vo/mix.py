"""Sound for বন্দি সবুজ দানা (The Green Prisoner) → out/mix.wav (48 kHz stereo, exactly DUR seconds).
Run after `node core/render/events.mjs <project>` (events.json from the picture); build.sh does both.
  Voice: the owner's own Bangla recording (src/voiceover.wav), the loudest thing in the mix.
  Chalk: synthesised (filtered grain noise), one sound per stroke, length from the stroke, level from its size on
         screen, panned where it is; the green chalk softer and duller. (The style's real chalk recordings live on
         Wikimedia, which this build environment cannot reach.)
  Room: wipe (felt pass), the sliding panel (low roll + stop knock), a distant school bell, room tone.
  Score: 84 bpm, sampled CC0 instruments: nylon guitar arpeggios, marimba (each green grain is "born" with a note),
         pizzicato bass, a bowed vibraphone under the panel slide; out for the held breath before the turn.
"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.expanduser('~/lemo-opuscar')
sys.path.insert(0, LIB)
import numpy as np, soundfile as sf, soxr
from core.audio import sampler as S
from core.audio.sfx import SR, add, limit, noise, bp, hp, lp, brown, thump, whoosh, compress

S.seed(5); rng = np.random.default_rng(11)
EV = json.load(open(os.path.join(HERE, 'events.json')))
DUR = EV['dur']; ev = EV['ev']; N = int(round(DUR * SR))
of = lambda k: [e for e in ev if e['type'] == k]
one = lambda k: of(k)[0]
voice, fx, mus = (np.zeros((N, 2), np.float32) for _ in range(3))

def fade(x, a=.004, b=.03):
    n = len(x); a, b = min(int(a * SR), n // 2), min(int(b * SR), n // 2)
    x = x.copy(); x[:a] *= np.linspace(0, 1, a); x[n - b:] *= np.linspace(1, 0, b); return x

# ---------------------------------------------------------------- voice (as recorded; gently levelled)
x, sr = sf.read(os.path.join(HERE, 'src', 'voiceover.wav'), dtype='float32')
if x.ndim > 1: x = x.mean(1)
x = soxr.resample(x, sr, SR) if sr != SR else x
x = hp(x, 80).astype(np.float32)
x = compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.3, ratio=2.5).astype(np.float32)
x = x / (np.sqrt(np.mean(x[np.abs(x) > .02] ** 2)) + 1e-9) * .11            # speaking level
add(voice, fade(x, .01, .05), one('vo')['t'], 1.0, 0)
vp = np.abs(voice[:, 0]); k = int(.3 * SR)                                     # voice presence → the score ducks under it
vp = np.convolve(vp, np.ones(k) / k, 'same'); vp = np.clip(vp / (np.percentile(vp, 99) + 1e-9) * 2.5, 0, 1)

# ---------------------------------------------------------------- chalk (synthesised grains)
def chalk(d, size, green=False):
    """one stroke: a quick bite, then a dry, grainy scratch whose grain rate follows the hand's speed"""
    n = int((d + .05) * SR); t = np.arange(n) / SR
    rate = 260 + 260 * np.sin(np.pi * np.clip(t / max(d, .02), 0, 1))          # grains per second: fast mid-stroke
    p = np.clip(rate / SR, 0, 1); imp = (rng.random(n) < p) * rng.uniform(.3, 1, n)
    k = np.exp(-np.arange(int(.0025 * SR)) / (.0006 * SR)) * rng.standard_normal(int(.0025 * SR))
    g = np.convolve(imp, k, 'same')
    g = bp(g, 1800, 7500) * .9 + bp(rng.standard_normal(n), 2500, 6000) * .05
    env = np.clip(t / .006, 0, 1) * np.clip((d + .03 - t) / .03, 0, 1)
    g = g * env
    bite = np.zeros(n); m = int(.012 * SR); bite[:m] = lp(rng.standard_normal(m), 2600) * np.exp(-np.arange(m) / (.0025 * SR)) * .8
    y = g + bite
    if green: y = lp(y, 3000) * .75                                            # the green chalk: softer, duller
    y = y / (np.abs(y).max() + 1e-9)
    return (y * np.clip(size / 260, .25, 1.0)).astype(np.float32)
for e in of('chalk'):
    add(fx, chalk(e['d'], e['len'], e['color'] == 'green'), e['t'], .085 * (1.25 if e['big'] else 1), e['pan'])
def tap(v=1.0):                                                               # chalk set down / a dot
    m = int(.05 * SR); y = lp(rng.standard_normal(m), 3200) * np.exp(-np.arange(m) / (.006 * SR))
    return (y / np.abs(y).max() * v + thump(.5 * v, 110)[:m] * .4).astype(np.float32)
for e in of('tap'): add(fx, tap(.9), e['t'], .12, 0)
# the wipe: a felt pass, swelling and fading, with the cloth's flutter
for e in of('wipe'):
    d = e["d"]; n = len(noise(d + .2)); t = np.arange(n) / SR
    y = bp(brown(d + .2) * .6 + noise(d + .2) * .4, 180, 1900) * np.sin(np.pi * np.clip(t / (d + .15), 0, 1)) ** 1.3 * (1 + .25 * np.sin(2 * np.pi * 9 * t))
    add(fx, (y / np.abs(y).max()).astype(np.float32), e['t'], .2, -.1)
# the sliding panel: a low roll along its track, then the stop knock
for e in of('slide'):
    d = e["d"]; n = len(brown(d)); t = np.arange(n) / SR
    y = lp(brown(d), 260) * (1 + .3 * np.sin(2 * np.pi * 7.5 * t)) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** .7
    add(fx, (y / np.abs(y).max()).astype(np.float32), e['t'], .1, .2)
    add(fx, thump(1.0, 85), e['t'] + d - .02, .12, .4); add(fx, tap(.8), e['t'] + d - .015, .1, .4)
for e in of('push'): add(fx, whoosh(e['d'], .8).astype(np.float32), e['t'], .05, 0)
for e in of('shut'): add(fx, tap(1.0), e['t'], .1, -.1)
# room tone, very low
rt = lp(brown(DUR), 380); rt = rt / np.abs(rt).max(); add(fx, rt.astype(np.float32), 0, .012, -.3); add(fx, np.roll(rt, 4000).astype(np.float32), 0, .012, .3)

# ---------------------------------------------------------------- score
BPM = 84; B = 60 / BPM; T0 = .3                                               # beat, and the grid's origin
ev_m = []
def arp(t0, chord, beats, vel=.32, step=.5, pan=-.25):
    """guitar arpeggio, one note per `step` beats, up and back"""
    seq = chord + chord[-2:0:-1]; k = 0; t = t0
    while t < t0 + beats * B - 1e-6:
        ev_m.append((t, 'guitar_nylon', seq[k % len(seq)], B * 1.6, vel * (1.1 if k % 4 == 0 else 1), pan)); k += 1; t += step * B
CH = {'Am': ['A2', 'E3', 'A3', 'C4', 'E4'], 'F': ['F2', 'C3', 'F3', 'A3', 'C4'], 'C': ['C3', 'G3', 'C4', 'E4', 'G4'], 'G': ['G2', 'D3', 'G3', 'B3', 'D4']}
ROOT = {'Am': 'A1', 'F': 'F1', 'C': 'C2', 'G': 'G1'}
bar = lambda i: T0 + i * 4 * B
wipe0 = one('wipe')['t']; slide = one('slide'); push = one('push'); ding = one('ding')['t']
# A · 1883 to the belief: Am F C G, sparse
for i, c in enumerate(['Am', 'F', 'C', 'G', 'Am']):
    if bar(i) + 4 * B > wipe0 - .5: arp(bar(i), CH[c], max(0, (wipe0 - .5 - bar(i)) / B), .3); break
    arp(bar(i), CH[c], 4, .3)
for k, e in enumerate(of('grain')):                                            # each green grain is born with a marimba note
    ev_m.append((e['t'], 'marimba', ['E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G5', 'A5'][k % 8], .6, .42, .25))
# B · the turn → the note (after the silence): C G Am F, pizzicato bass enters
tB = wipe0 + .9; nB = int((slide['t'] - tB) // (4 * B))
for i in range(nB):
    c = ['C', 'G', 'Am', 'F'][i % 4]; t = tB + i * 4 * B
    arp(t, CH[c], 4, .34)
    ev_m.append((t, 'contrabass_pizz', ROOT[c], 1.5, .5, .1)); ev_m.append((t + 2 * B, 'contrabass_pizz', ROOT[c], 1.2, .38, .1))
# under the slide: one held, airy note
ev_m.append((slide['t'] - .2, 'vibraphone_bowed', 'E4', slide['d'] + 1.4, .4, 0))
# C · decades later → the sun and the world: fuller, still soft
tC = slide['t'] + slide['d'] + .5; end_C = push['t'] - 6.2
i = 0
while tC + (i + 1) * 4 * B <= end_C + .01:
    c = ['Am', 'F', 'C', 'G'][i % 4]; t = tC + i * 4 * B
    arp(t, CH[c], 4, .36)
    ev_m.append((t, 'contrabass_pizz', ROOT[c], 1.5, .5, .1)); ev_m.append((t + 2 * B, 'contrabass_pizz', ROOT[c], 1.2, .38, .1))
    for j in (1, 3): ev_m.append((t + j * B + B / 2, 'marimba', CH[c][3], .3, .22, .35))
    i += 1
for r in [e['t'] for e in of('rays')]:                                         # the sun's rays: a rising marimba run
    for j, p in enumerate(['A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'A6']): ev_m.append((r + j * .055, 'marimba', p, .4, .3 + j * .02, .3))
# D · the verdict: one guitar line, a held C chord on গল্প
tD = tC + i * 4 * B
for k, p in enumerate(['E4', 'D4', 'C4', 'A3', 'G3', 'A3', 'C4', 'D4']):
    if tD + k * B < push['t'] - 2.4: ev_m.append((tD + k * B, 'guitar_nylon', p, B * 1.8, .3, -.2))
story_tap = [e['t'] for e in of('tap')][-1]
for j, p in enumerate(['C3', 'G3', 'C4', 'E4', 'G4']): ev_m.append((story_tap - .35 + j * .045, 'guitar_nylon', p, 4.0, .36, -.15))
# E · end card: the green dot rings
for j, p in enumerate(['C3', 'G3', 'E4', 'G4', 'C5']): ev_m.append((ding - .02 + j * .05, 'guitar_nylon', p, 4.0, .34, -.1))
ev_m.append((ding, 'marimba', 'C6', 1.5, .55, .2)); ev_m.append((ding + .25, 'marimba', 'G6', 1.5, .4, .25))
ev_m.append((ding, 'contrabass_pizz', 'C2', 2.0, .45, 0))
m = S.render([e for e in ev_m if e[0] < DUR], dur=DUR, master=False)
m = S.room(m, size=.45, mix=.2)
mus[:min(N, len(m))] += m[:N] * .5
# the bell over the wide shot of the classroom: distant, low, through the wall
for e in of('bell'):
    b = lp(S.note('tubular_bells', 'G4', 3.0, vel=.5), 2500)
    add(fx, b.astype(np.float32), e['t'], .06, -.5)
# the score ducks ≈ 15 dB under speech, and is out for the held breath before the turn
duck = 1 - .82 * vp
gate = np.ones(N); a, b2 = int((wipe0 - .55) * SR), int((wipe0 + .85) * SR); gate[a:b2] = 0
gate = np.convolve(gate, np.ones(int(.12 * SR)) / int(.12 * SR), 'same')
mus *= (duck * gate)[:, None].astype(np.float32)
lift = 1 + 1.6 * np.clip((np.arange(N) / SR - (ding - .3)) / .3, 0, 1)        # the end card: the score comes forward
mus *= lift[:, None].astype(np.float32)

# ---------------------------------------------------------------- mix
out = voice + fx + mus
out = np.stack([limit(out[:, 0], .95), limit(out[:, 1], .95)], 1)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), out.astype(np.float32), SR, subtype='PCM_24')
print('mix.wav', round(DUR, 2), 's; peak', round(float(np.abs(out).max()), 3))
with open(os.path.join(HERE, 'out', 'instruments.txt'), 'w') as f: f.write('\n'.join(S.credits(sorted({e[1] for e in ev_m} | {'tubular_bells'}))))
