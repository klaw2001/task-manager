#!/usr/bin/env python3
"""Procedural score + UI sound design for the Task Manager showcase.

Reads audio/events.json (cues exported from the composition) and writes audio/mix.wav (48 kHz stereo).
Everything is synthesised with numpy — no samples, no licensing.
"""
import json, os, sys, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(HERE, "events.json")))
TOTAL = float(ev["total"])
DUR = TOTAL + 1.5
N = int(SR * DUR)
rng = np.random.default_rng(11)

BPM = 96.0
BEAT = 60.0 / BPM          # 0.625 s
BAR = BEAT * 4              # 2.5 s
T0 = 5.0                    # downbeat = the "boom" that opens the logo reveal

def mtof(m): return 440.0 * 2 ** ((np.asarray(m, dtype=np.float64) - 69) / 12)

def stereo(): return np.zeros((2, N), dtype=np.float32)
def add(buf, t, sig, gain=1.0, pan=0.0):
    """Mix mono `sig` into stereo `buf` at time t (s) with equal-power pan [-1..1]."""
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    a = max(0, -i); b = min(len(sig), N - i)
    seg = sig[a:b].astype(np.float32) * gain
    ang = (pan + 1) * np.pi / 4
    buf[0, i + a:i + b] += seg * np.cos(ang)
    buf[1, i + a:i + b] += seg * np.sin(ang)

def env_ad(n, a, d, curve=3.0):
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1)
    dec = np.exp(-t / max(d, 1e-4) * curve / 3)
    return att * dec

def lp(x, fc):
    """One-pole low-pass (vectorised via exponential smoothing in chunks of IIR using lfilter-free approach)."""
    a = np.exp(-2 * np.pi * fc / SR)
    # simple forward IIR through numpy: use cumulative trick for speed on short signals
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y

def lp_fast(x, fc):
    """Box-ish smoothing low-pass for long arrays (FFT one-pole)."""
    n = len(x)
    a = np.exp(-2 * np.pi * fc / SR)
    k = np.arange(min(n, int(SR * 0.05)))
    h = (1 - a) * a ** k
    L = 1 << int(np.ceil(np.log2(n + len(h))))
    return np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(h, L), L)[:n]

def hp_fast(x, fc): return x - lp_fast(x, fc)

def noise(n): return rng.standard_normal(n).astype(np.float64)

# ───────────────────────── instruments ─────────────────────────
def pad_note(freq, length, gain=1.0, attack=1.0, release=1.6):
    n = int((length + release) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for cents, pan_phase in ((-7, 0.0), (0, 1.3), (7, 2.1)):
        f = freq * 2 ** (cents / 1200)
        for k, amp in ((1, 1.0), (2, 0.42), (3, 0.22), (4, 0.12), (5, 0.07)):
            y += amp * np.sin(2 * np.pi * f * k * t + pan_phase * k)
    # slow tremolo for movement
    y *= 1 + 0.06 * np.sin(2 * np.pi * 0.23 * t + freq)
    e = np.clip(t / attack, 0, 1) ** 1.5
    r = np.clip((length + release - t) / release, 0, 1) ** 1.5
    return y * e * r * gain / 6

def pluck(freq, length=0.9, gain=1.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, amp, dec in ((1, 1.0, 0.45), (2, 0.5, 0.28), (3, 0.28, 0.18), (4, 0.15, 0.12), (6, 0.06, 0.08)):
        y += amp * np.sin(2 * np.pi * freq * k * t) * np.exp(-t / dec)
    y *= np.clip(t / 0.004, 0, 1)
    return y * gain

def sub(freq, length, gain=1.0):
    n = int((length + 0.25) * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2 * t)
    e = np.clip(t / 0.04, 0, 1) * np.clip((length + 0.25 - t) / 0.25, 0, 1)
    return y * e * gain

def kick(gain=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.13)
    y += 0.35 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.004)  # click
    return y * gain

def clap(gain=1.0):
    n = int(0.28 * SR); t = np.arange(n) / SR
    x = hp_fast(noise(n), 1400)
    x = lp_fast(x, 7000)
    e = np.zeros(n)
    for d in (0.0, 0.012, 0.024):  # flam
        i = int(d * SR); e[i:] += np.exp(-np.arange(n - i) / SR / 0.012) * 0.5
    e += np.exp(-t / 0.07) * 0.6
    return x * e * gain

def hat(gain=1.0, open_=False):
    n = int((0.16 if open_ else 0.05) * SR); t = np.arange(n) / SR
    x = hp_fast(noise(n), 6500)
    return x * np.exp(-t / (0.06 if open_ else 0.014)) * gain

# ───────────────────────── SFX ─────────────────────────
def sfx_click():
    n = int(0.09 * SR); t = np.arange(n) / SR
    down = hp_fast(noise(n), 1800) * np.exp(-t / 0.004) * 0.9
    body = np.sin(2 * np.pi * 950 * t) * np.exp(-t / 0.014) * 0.5
    up = np.zeros(n); j = int(0.055 * SR)
    up[j:] = hp_fast(noise(n - j), 2500) * np.exp(-np.arange(n - j) / SR / 0.003) * 0.35
    return down + body + up

def sfx_key():
    n = int(0.05 * SR); t = np.arange(n) / SR
    f = rng.uniform(1500, 2300)
    return (hp_fast(noise(n), 2200) * np.exp(-t / 0.003) * 0.6 + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.008) * 0.3) * rng.uniform(0.7, 1.0)

def sfx_tick():
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = 1250 * np.exp(-t / 0.05) + 560
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * 0.7

def sfx_pop():
    n = int(0.16 * SR); t = np.arange(n) / SR
    f = 380 + 900 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)

def sfx_whoosh(length=0.7, lo=250, hi=5200, up=True):
    n = int(length * SR); t = np.arange(n) / SR
    x = noise(n)
    # sweeping band: crossfade between progressively brighter low-passed copies
    lo_s = lp_fast(x, lo * 2); mid_s = lp_fast(x, 1400); hi_s = lp_fast(x, hi)
    p = t / length
    if not up: p = 1 - p
    sig = (lo_s * np.clip(1 - 2 * p, 0, 1) + mid_s * np.clip(1 - np.abs(2 * p - 1) * 2, 0, 1) + hi_s * np.clip(2 * p - 1, 0, 1))
    sig = hp_fast(sig, 120)
    e = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    return sig * e * 2.2

def sfx_chime(f0=659.25):
    out = np.zeros(int(1.4 * SR))
    for i, (f, d) in enumerate(((f0, 0.0), (f0 * 1.5, 0.11), (f0 * 2.0, 0.22))):
        n = int(1.2 * SR); t = np.arange(n) / SR
        s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.15)) * np.exp(-t / 0.35) * np.clip(t / 0.003, 0, 1)
        j = int(d * SR); out[j:j + n] += s[: len(out) - j] * (0.8 - 0.15 * i)
    return out

def sfx_thunk(f0=190, f1=70, length=0.16):
    n = int(length * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * np.clip(t / 0.002, 0, 1)

def sfx_error():
    return np.concatenate([sfx_thunk(240, 150, 0.14), np.zeros(int(0.06 * SR)), sfx_thunk(190, 110, 0.2)])

def sfx_boom():
    n = int(3.2 * SR); t = np.arange(n) / SR
    f = 34 + 70 * np.exp(-t / 0.18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.1)
    imp = lp_fast(noise(n), 900) * np.exp(-t / 0.35) * 0.9
    ring = np.sin(2 * np.pi * 110 * t) * np.exp(-t / 1.4) * 0.35
    return s * 1.3 + imp + ring

def riser(length=3.6):
    n = int(length * SR); t = np.arange(n) / SR
    x = noise(n)
    p = t / length
    # brighten over time by mixing progressively higher-passed noise
    y = hp_fast(x, 300) * (0.3 + 0.7 * p ** 2) + hp_fast(x, 3000) * p ** 3
    return y * (p ** 2.2) * np.sin(0.5 * np.pi * np.clip(p * 1.0, 0, 1) + 0.0001)

def shimmer(notes=(880, 1318.5, 1760, 2637), length=2.6):
    n = int(length * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for i, f in enumerate(notes):
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / (1.0 + 0.2 * i)) * np.clip((t - 0.08 * i) / 0.02, 0, 1)
        s[: int(0.08 * i * SR)] = 0
        y += s * (0.5 / (1 + 0.35 * i))
    return y

# ───────────────────────── score ─────────────────────────
CHORDS = {  # voicings (MIDI) + bass root
    "Am9":   ([57, 60, 64, 67, 71], 45),
    "Fmaj7": ([57, 60, 64, 65, 69], 41),
    "Cmaj7": ([55, 59, 60, 64, 67], 48),
    "G6":    ([55, 59, 62, 64, 67], 43),
}
PROG = ["Am9", "Fmaj7", "Cmaj7", "G6"]
CH_LEN = BAR * 2  # 5 s per chord

SCENE_T = [e["t"] for e in ev["events"] if e["type"] == "scene"]  # intro, setup, dashboard, … outro
def intensity_edges():
    """Section automation keyed to chapter starts: (start, end, dict)."""
    st = SCENE_T
    names = ["intro", "setup", "dashboard", "tasks", "board", "peek", "newtask", "filters", "notifs", "company", "people", "teams", "roles", "dark", "security", "stack", "outro"]
    at = dict(zip(names, st))
    return [
        (0.0, 5.0, dict(drone=1)),
        (5.0, at["dashboard"], dict(pad=1, pluck=0.55 if False else 0.62, bass=0, drums=0)),
        (at["dashboard"], at["tasks"], dict(pad=1, pluck=0.7, bass=0, drums=1)),
        (at["tasks"], at["company"], dict(pad=1, pluck=0.8, bass=1, drums=1)),
        (at["company"], at["dark"], dict(pad=1, pluck=1.0, bass=1, drums=2)),
        (at["dark"], at["security"], dict(pad=1, pluck=0.85, bass=1, drums=1)),
        (at["security"], at["stack"], dict(pad=1, pluck=0.6, bass=1, drums=0)),
        (at["stack"], at["outro"], dict(pad=1, pluck=0.85, bass=1, drums=1)),
        (at["outro"], 400.0, dict(pad=1, pluck=0.0, bass=0, drums=0, outro=1)),
    ]

def section(t):
    for a, b, d in intensity_edges():
        if a <= t < b: return d
    return {}

music = stereo(); musicRev = stereo(); sfx = stereo(); sfxRev = stereo(); drums = stereo(); duck_times = []

# 0–5 s: tension — low drone, thuds, riser
for f, g in ((55.0, 0.5), (82.41, 0.3), (110.0, 0.22)):
    n = int(5.4 * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.4 * t)) * np.clip(t / 2.2, 0, 1) ** 2 * np.clip((5.4 - t) / 0.4, 0, 1)
    add(music, 0.0, y, g * 0.55, 0.0)
add(musicRev, 1.0, riser(4.0), 0.30, 0.0)
for i, tt in enumerate(np.arange(0.9, 4.9, 1.0)):
    add(music, tt, sfx_thunk(120, 52, 0.28), 0.12 + 0.07 * i, 0.0)

# harmony from the boom onward
t_cur = T0; ci = 0
while t_cur < DUR:
    name = PROG[ci % 4]; notes, root = CHORDS[name]
    sec = section(t_cur)
    outro = sec.get("outro", 0)
    L = CH_LEN if not outro else 8.5
    if sec.get("pad"):
        for k, m in enumerate(notes):
            add(music, t_cur, pad_note(mtof(m), L, 0.9 if not outro else 1.1, attack=1.2 if t_cur > T0 else 0.6), 1.0, (k - 2) * 0.28)
            add(musicRev, t_cur, pad_note(mtof(m + 12), L, 0.35, attack=1.4), 0.5, (2 - k) * 0.3)
        if sec.get("bass") or t_cur < SCENE_T[3]:
            add(music, t_cur, sub(mtof(root - 12), L - 0.2, 0.26), 1.0, 0.0)
    t_cur += L if not outro else 1e9
    ci += 1

# pluck arpeggio (eighths)
eighth = BEAT / 2
pattern = [0, 2, 3, 4, 3, 2, 1, 2]
tt = T0; step = 0
while tt < DUR - 6:
    sec = section(tt)
    if sec.get("pluck", 0) > 0:
        name = PROG[int((tt - T0) // CH_LEN) % 4]; notes, _ = CHORDS[name]
        idx = pattern[step % 8]; m = notes[idx % len(notes)] + 12
        accent = 1.0 if step % 8 in (0, 4) else 0.72
        g = 0.16 * sec["pluck"] * accent
        if sec.get("drums", 0) == 0 and step % 2: g *= 0.0  # sparse in breakdowns
        if g > 0:
            add(music, tt, pluck(mtof(m), 0.9, 1.0), g, np.sin(step * 0.9) * 0.55)
            add(musicRev, tt, pluck(mtof(m), 0.9, 1.0), g * 0.9, -np.sin(step * 0.9) * 0.5)
        if sec.get("drums", 0) == 2 and step % 8 in (3, 7):
            add(music, tt, pluck(mtof(m + 12), 0.5, 1.0), g * 0.45, np.sin(step) * 0.7)
    tt += eighth; step += 1

# drums
bt = T0; beat_i = 0
while bt < DUR - 8:
    sec = section(bt); lvl = sec.get("drums", 0)
    if lvl:
        bar_pos = beat_i % 4
        if bar_pos in (0, 2) or (lvl == 2 and bar_pos == 3 and (beat_i // 4) % 2 == 1 and False):
            add(drums, bt, kick(1.0), 0.5, 0.0); duck_times.append(bt)
        if bar_pos in (1, 3):
            add(drums, bt, clap(1.0), 0.20 if lvl == 1 else 0.26, 0.05)
        for k in range(2):
            ht = bt + k * eighth
            add(drums, ht, hat(1.0, open_=(k == 1 and bar_pos == 3)), (0.075 if k == 0 else 0.105) * (1.0 if lvl == 1 else 1.25), 0.35 if k else -0.2)
        if lvl == 2 and bar_pos == 2:  # little ghost kick before beat 4 for forward motion
            add(drums, bt + eighth * 1.5, kick(0.6), 0.26, 0.0); duck_times.append(bt + eighth * 1.5)
    bt += BEAT; beat_i += 1

# cue-synced UI sounds
def has_near(events, t, types, tol):
    return any(abs(e["t"] - t) < tol and e["type"] in types for e in events)

events = sorted(ev["events"], key=lambda e: e["t"])
last_click = -1
rr = np.random.default_rng(3)
for e in events:
    t, ty = e["t"], e["type"]
    if ty == "scene":
        if t < 1: continue
        if has_near(events, t, ("whoosh", "swoosh", "boom"), 0.3): continue
        add(sfx, max(0, t - 0.28), sfx_whoosh(0.85, 200, 4500), 0.20, rr.uniform(-0.3, 0.3)); add(sfxRev, max(0, t - 0.28), sfx_whoosh(0.85, 200, 4500), 0.10)
    elif ty == "swoosh":
        add(sfx, t - 0.35, sfx_whoosh(0.9, 200, 6000), 0.30); add(sfxRev, t - 0.35, sfx_whoosh(0.9), 0.15)
    elif ty == "whoosh":
        add(sfx, t - 0.1, sfx_whoosh(0.7, 300, 4800), 0.24); add(sfxRev, t - 0.1, sfx_whoosh(0.7), 0.1)
    elif ty == "boom":
        add(sfx, t, sfx_boom(), 0.9); add(sfxRev, t, sfx_boom(), 0.25)
    elif ty == "shimmer":
        add(sfx, t, shimmer(), 0.16, 0.2); add(sfxRev, t, shimmer(), 0.3, -0.2)
    elif ty == "click":
        if t - last_click < 0.09: continue
        last_click = t
        add(sfx, t, sfx_click(), 0.28, rr.uniform(-0.15, 0.15))
    elif ty == "key":
        add(sfx, t, sfx_key(), 0.20, rr.uniform(-0.2, 0.2))
    elif ty == "tick":
        add(sfx, t, sfx_tick(), 0.075, rr.uniform(-0.5, 0.5)); add(sfxRev, t, sfx_tick(), 0.05)
    elif ty == "pop":
        add(sfx, t, sfx_pop(), 0.14, rr.uniform(-0.3, 0.3)); add(sfxRev, t, sfx_pop(), 0.05)
    elif ty == "chime":
        add(sfx, t, sfx_chime(), 0.17, 0.0); add(sfxRev, t, sfx_chime(), 0.15)
    elif ty == "grab":
        add(sfx, t, sfx_thunk(220, 90, 0.12), 0.3)
    elif ty == "drop":
        add(sfx, t, sfx_thunk(170, 60, 0.2), 0.42); add(sfx, t + 0.02, sfx_pop(), 0.16); add(sfxRev, t, sfx_chime(783.99), 0.14)
    elif ty == "error":
        add(sfx, t, sfx_error(), 0.36); add(sfxRev, t, sfx_error(), 0.08)
    elif ty == "tail":
        add(sfx, t, shimmer((659.25, 987.77, 1318.5, 1975.5), 3.2), 0.22, 0.0); add(sfxRev, t, shimmer((659.25, 987.77, 1318.5, 1975.5), 3.2), 0.35)

# ───────────────────────── mastering chain ─────────────────────────
def reverb(buf, ir_len=2.8, tone=3500):
    n_ir = int(ir_len * SR); t = np.arange(n_ir) / SR
    out = np.zeros_like(buf)
    for ch in range(2):
        ir = noise(n_ir) * np.exp(-t / (ir_len / 4.2)) * (1 - np.exp(-t / 0.02))
        ir = lp_fast(ir, tone)
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        L = 1 << int(np.ceil(np.log2(N + n_ir)))
        out[ch] = np.fft.irfft(np.fft.rfft(buf[ch].astype(np.float64), L) * np.fft.rfft(ir, L), L)[:N]
    return out

print("reverb…", flush=True)
rev_m = reverb(musicRev, 3.2, 3000)
rev_s = reverb(sfxRev, 2.0, 5000)

# sidechain "pump" on the musical bed (not on drums/sfx)
duck = np.ones(N, dtype=np.float32)
for tk in duck_times:
    i = int(tk * SR); n = min(int(0.38 * SR), N - i)
    if n <= 0: continue
    seg = 1 - 0.42 * np.exp(-np.arange(n) / SR / 0.11)
    duck[i:i + n] = np.minimum(duck[i:i + n], seg.astype(np.float32))

bed = (music + rev_m * 0.9) * duck
sfxbus = sfx + rev_s * 0.9

def rms_db(x, a=10.0, b=-8.0):
    seg = x[:, int(a * SR):int(b * SR)]
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
print("stem RMS dBFS  bed %.1f  drums %.1f  sfx %.1f" % (rms_db(bed), rms_db(drums), rms_db(sfxbus)), flush=True)
# balance stems: bed leads, drums sit 5 dB under, UI sounds accent on top
g_bed = 10 ** ((-21 - rms_db(bed)) / 20)
g_drm = 10 ** ((-27.5 - rms_db(drums)) / 20) if rms_db(drums) > -80 else 0
g_sfx = 10 ** ((-29 - rms_db(sfxbus)) / 20)
mix = bed * g_bed + drums * g_drm + sfxbus * g_sfx

# DC/sub clean-up
for ch in range(2):
    mix[ch] = mix[ch] - lp_fast(mix[ch].astype(np.float64), 30).astype(np.float32)

# fades
fade = np.ones(N, dtype=np.float32)
fi = int(0.8 * SR); fade[:fi] = np.linspace(0, 1, fi) ** 2
fo = int(0.5 * SR); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade

# lookahead peak limiter (block max → anticipatory min → release smoothing → interpolate)
THR = 0.89
B = 128
nb = N // B
pk = np.abs(mix[:, :nb * B]).max(0).reshape(nb, B).max(1)
g = np.minimum(1.0, THR / np.maximum(pk, 1e-9))
g = np.minimum(g, np.minimum(np.roll(g, 1), np.roll(g, -1)))
g = np.minimum(g, np.minimum(np.roll(g, 2), np.roll(g, -2)))
gs = g.copy()
for i in range(1, nb):
    gs[i] = min(g[i], gs[i - 1] + (1 - gs[i - 1]) * 0.015)
for i in range(nb - 2, -1, -1):          # attack ramp (lookahead)
    gs[i] = min(gs[i], gs[i + 1] + (1 - gs[i + 1]) * 0.35)
gfull = np.interp(np.arange(N), (np.arange(nb) + 0.5) * B, gs).astype(np.float32)
mix *= gfull
print("limiter: min gain %.2f dB, post peak %.3f" % (20 * np.log10(gs.min()), np.abs(mix).max()), flush=True)

pcm = (np.clip(mix, -1, 1).T * 32767).astype(np.int16)
out = os.path.join(HERE, "mix.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out, f"{DUR:.1f}s", flush=True)
