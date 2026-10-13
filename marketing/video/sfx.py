"""Synthesise every sound effect and the music bed (no third-party audio, so no licence issues)."""
import numpy as np, wave, sys
SR = 48000
OUT = sys.argv[1]
rng = np.random.default_rng(7)

def save(name, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1: x = np.stack([x, x], 1)
    peak = np.max(np.abs(x)) or 1
    x = x / peak * 0.89
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())

t_ = lambda d: np.arange(int(d * SR)) / SR
def env(n, a=0.005, r=None, d=None):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    if d is not None: e *= np.exp(-np.arange(n) / SR / d)
    if r: nr = int(r * SR); e[-nr:] *= np.linspace(1, 0, nr)
    return e
def lowpass(x, fc):
    # one-pole, fc may be an array (sweep)
    fc = np.broadcast_to(fc, x.shape); a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y
def bell(f, d, decay=0.6, parts=((1, 1), (2.76, .35), (5.4, .15), (8.93, .06))):
    t = t_(d); return sum(g * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (decay / m ** .5)) for m, g in parts) * env(len(t), .002)
def pad(x, d): return np.concatenate([x, np.zeros(max(0, int(d * SR) - len(x)))])

# ring: old-phone double trill (440+480 Hz, 20 Hz tremolo), twice
t = t_(0.42); trill = (np.sin(2*np.pi*440*t) + np.sin(2*np.pi*480*t)) * (0.5 + 0.5*np.sign(np.sin(2*np.pi*20*t))) * env(len(t), .01, .03)
ring = np.concatenate([trill, np.zeros(int(.18*SR)), trill, np.zeros(int(.5*SR))]); save('ring', np.tile(ring, 2))
# missed: sad two-note fall
save('missed', np.concatenate([bell(659, .22, .25), bell(494, .5, .35)]))
# pop: short pitched bubble
t = t_(.09); f = 900 * np.exp(-t * 18) + 380; save('pop', np.sin(2*np.pi*np.cumsum(f)/SR) * env(len(t), .002, d=.03))
# tap: click
t = t_(.05); save('tap', (rng.standard_normal(len(t)) * .5 * np.exp(-t/.004) + np.sin(2*np.pi*2400*t) * np.exp(-t/.012)))
# whoosh / swipe: noise through a sweeping low-pass with a swell
def whoosh(d, f0, f1):
    n = int(d * SR); x = rng.standard_normal(n); sw = np.geomspace(f0, f1, n); s = np.sin(np.linspace(0, np.pi, n)) ** 2
    return lowpass(x, sw) * s
save('whoosh', whoosh(.7, 300, 5000)); save('swipe', whoosh(.32, 800, 3500))
# success: rising C-E-G-C chime
save('success', sum(pad(np.concatenate([np.zeros(int(i*.09*SR)), bell(f, 1.0, .5)]), 1.4) for i, f in enumerate([1047, 1319, 1568, 2093])))
# ding: notification (E6 then B6)
save('ding', pad(bell(1319, .9, .45), 1.1) + pad(np.concatenate([np.zeros(int(.13*SR)), bell(1976, .9, .45)]), 1.1))
# cash: metallic hit + bell "ka-ching"
t = t_(.08); hit = rng.standard_normal(len(t)) * np.exp(-t/.015); bl = bell(2637, 1.0, .5, ((1,1),(1.5,.6),(2.02,.4),(3.1,.2)))
save('cash', pad(hit, 1.15) + pad(np.concatenate([np.zeros(int(.1*SR)), bl]), 1.15))
# shimmer: brand reveal sparkle
d = 1.6; sh = np.zeros(int(d*SR))
for i, f in enumerate([1568, 1760, 2093, 2349, 2637, 3136, 3520]):
    o = int(i * .06 * SR); b = bell(f, d - i*.06, .7) * (.6 + .4*i/6); sh[o:o+len(b)] += b
save('shimmer', sh + whoosh(d, 2000, 8000) * .25)

# ---- music bed: 100 bpm, I–V–vi–IV in C, warm & upbeat ----
BPM = 100; beat = 60 / BPM; bars = int(sys.argv[2]) if len(sys.argv) > 2 else 28
n = int(bars * 4 * beat * SR) + SR; L = np.zeros(n); R = np.zeros(n)
def put(buf, x, at):
    i = int(at * SR); x = x[:max(0, len(buf) - i)]; buf[i:i+len(x)] += x
def ks(f, d):  # Karplus-Strong pluck
    N = int(SR / f); bufk = rng.uniform(-1, 1, N); out = np.zeros(int(d*SR))
    for i in range(len(out)):
        out[i] = bufk[i % N]; bufk[i % N] = .5 * (bufk[i % N] + bufk[(i+1) % N]) * .996
    return out
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[48, 52, 55, 60, 64], [43, 47, 50, 55, 59], [45, 48, 52, 57, 60], [41, 45, 48, 53, 57]]
for bar in range(bars):
    ch = chords[bar % 4]; t0 = bar * 4 * beat
    # pad (soft sines with a slow swell)
    td = t_(4 * beat); sw = np.sin(np.linspace(0, np.pi, len(td))) ** .6
    for m in ch[1:]:
        x = (np.sin(2*np.pi*midi(m+12)*td) + .3*np.sin(2*np.pi*midi(m+12)*2.003*td)) * sw * .05
        put(L, x, t0); put(R, x * .9, t0 + .012)
    # bass on 1 and the "and" of 2
    for off in (0, 1.5, 2.5):
        tb = t_(beat * .9); xb = np.sin(2*np.pi*midi(ch[0]-12)*tb) * env(len(tb), .005, d=.35) * .32
        put(L, xb, t0 + off*beat); put(R, xb, t0 + off*beat)
    # plucked arpeggio, 8ths
    pat = [3, 4, 2, 4, 3, 4, 1, 4]
    for k, idx in enumerate(pat):
        x = ks(midi(ch[idx] + 12), .45) * .16; pan = .35 + .3 * (k % 2)
        put(L, x * (1 - pan), t0 + k*beat/2); put(R, x * pan, t0 + k*beat/2)
    # drums: kick 1 & 3, clap 2 & 4, hats on 8ths (from bar 0)
    for q in range(4):
        tk = t_(.25); fk = 110*np.exp(-tk*30)+45; kick = np.sin(2*np.pi*np.cumsum(fk)/SR) * np.exp(-tk/.12) * .55
        if q in (0, 2): put(L, kick, t0+q*beat); put(R, kick, t0+q*beat)
        if q in (1, 3):
            tc = t_(.18); cl = rng.standard_normal(len(tc)) * np.exp(-tc/.04) * .12; cl = cl - lowpass(cl, 900)
            put(L, cl, t0+q*beat); put(R, cl, t0+q*beat)
        for h in (0, .5):
            th = t_(.05); hh = rng.standard_normal(len(th)) * np.exp(-th/.012) * (.05 if h else .03); hh = hh - lowpass(hh, 6000)
            put(L, hh*.8, t0+(q+h)*beat); put(R, hh, t0+(q+h)*beat)
save('music', np.stack([L, R], 1))
print('ok')
