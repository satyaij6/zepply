"""
Zepply reel audio: music beds and UI sound effects, synthesized in numpy.

No samples and no models, so every sound is ours to ship in the product. All output is
deterministic (seeded noise), so re-running produces byte-identical files.

    python packages/reels/audio/generate.py <out_dir>

Writes <out_dir>/music/<mood>-<length>.mp3 and <out_dir>/sfx/<name>.mp3 (needs ffmpeg on PATH).

Every bed is 120 BPM (one beat = 0.5 s), and its sections line up with the template's
scene cuts in packages/reels/src/timing.mjs, so the drop, the tagline hits and the logo boom
land on the visual beats.
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

SR = 44100
BEAT = 0.5

# Mirrors SCENES in packages/reels/src/timing.mjs. Keep the two in step.
TIMING = {
    "standard": {"length": 30.0, "drop": 4.0, "build": 9.5, "tagline": 20.0, "cta": 24.0},
    "short": {"length": 15.0, "drop": 3.0, "build": None, "tagline": 7.5, "cta": 11.0},
}

MOODS = {
    # chords one per bar (2 s); pad brightness; which layers play
    "upbeat": {
        "prog": [[53, 57, 60, 64, 67], [57, 60, 64, 67, 71], [48, 55, 59, 62, 64], [55, 59, 62, 64, 69]],
        "bright": (700, 1400, 900), "kick": "four", "claps": True, "hats": True, "bass": True, "hit_root": 69,
    },
    "calm": {
        "prog": [[50, 57, 62, 64, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]],
        "bright": (500, 900, 700), "kick": "half", "claps": False, "hats": False, "bass": True, "hit_root": 66,
    },
    "premium": {
        "prog": [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62], [40, 47, 52, 55, 59]],
        "bright": (420, 1000, 650), "kick": "four", "claps": False, "hats": True, "bass": True, "hit_root": 64,
    },
}

midi = lambda m: 440 * 2 ** ((m - 69) / 12)


def lowpass(x, cutoff):
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc += a[k] * (x[k] - acc)
        y[k] = acc
    return y


def env(n, a=0.005, r=0.2):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    nr = min(n, int(r * SR))
    e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


class Bus:
    def __init__(self, seconds):
        self.n = int(SR * seconds)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, sig, start, gain=1.0, pan=0.0):
        i = int(start * SR)
        j = min(self.n, i + len(sig))
        if j <= i:
            return
        s = sig[: j - i] * gain
        self.L[i:j] += s * np.sqrt(0.5 * (1 - pan)) * 1.414
        self.R[i:j] += s * np.sqrt(0.5 * (1 + pan)) * 1.414

    def stereo(self):
        return np.stack([self.L, self.R], axis=1)


# ---------------------------------------------------------------- instruments

def kick(rng):
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    f = 45 + 80 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 7) + 0.3 * np.sin(ph * 2) * np.exp(-tt * 30)


def hat(rng, decay=40):
    n = int(0.06 * SR)
    x = rng.standard_normal(n)
    x = x - lowpass(x, 7000)
    return x * np.exp(-np.arange(n) / SR * decay)


def clap(rng):
    n = int(0.18 * SR)
    x = rng.standard_normal(n)
    x = lowpass(x - lowpass(x, 900), 6000)
    e = np.exp(-np.arange(n) / SR * 22)
    for d in (0.0, 0.012, 0.024):
        k = int(d * SR)
        e[k:] += 0.4 * np.exp(-np.arange(n - k) / SR * 60)
    return x * e


def riser(rng, dur):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    return lowpass(x, np.linspace(300, 9000, n)) * np.linspace(0, 1, n) ** 2


def pad_chord(rng, notes, dur, bright):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        for det in (-0.07, 0.0, 0.07):
            f = midi(m) * 2 ** (det / 12)
            x += 2 * ((tt * f + rng.random()) % 1) - 1
    x /= len(notes) * 3
    x = lowpass(x, bright)
    e = np.minimum(1, tt / 0.35) * np.minimum(1, (dur - tt) / 0.4)
    return x * e


def tone_hit(K, m, big=False):
    n = int((1.6 if big else 0.9) * SR)
    tt = np.arange(n) / SR
    tone = sum(np.sin(2 * np.pi * midi(m + i) * tt) * w for i, w in ((0, 1), (12, 0.35), (19, 0.2)))
    k = K[:n] if len(K) >= n else np.pad(K, (0, n - len(K)))
    return tone * np.exp(-tt * (2.2 if big else 4.5)) + k * 0.9


# ---------------------------------------------------------------- music

def bed(mood_name, length_name):
    mood = MOODS[mood_name]
    tm = TIMING[length_name]
    length = tm["length"]
    rng = np.random.default_rng(7)
    bus = Bus(length)
    K = kick(rng)
    drop, tagline, cta = tm["drop"], tm["tagline"], tm["cta"]
    build = tm["build"] if tm["build"] is not None else drop
    b_lo, b_mid, b_out = mood["bright"]

    # pads, one chord per bar
    bar = 0
    while bar * 2.0 < length - 0.2:
        start = bar * 2.0
        chord = mood["prog"][bar % 4]
        bright = b_lo if start < drop else (b_mid if start < tagline else b_out)
        gain = 0.16 if start < cta else 0.13
        bus.add(pad_chord(rng, chord, 2.05, bright), start, gain, pan=-0.25)
        bus.add(pad_chord(rng, [n + 12 for n in chord[2:]], 2.05, bright * 0.8), start, gain * 0.35, pan=0.3)
        bar += 1

    beats = lambda a, b: range(int(round(a / BEAT)), int(round(b / BEAT)))

    # kick from the drop until the tagline
    for b in beats(drop, tagline):
        if mood["kick"] == "four" or b % 2 == 0:
            bus.add(K, b * BEAT, 0.55 if mood["kick"] == "four" else 0.42)

    # offbeat bass
    if mood["bass"]:
        for b in beats(drop, tagline):
            sec = b * BEAT
            root = mood["prog"][int(sec // 2) % 4][0] - 12
            n = int(BEAT * 0.45 * SR)
            tt = np.arange(n) / SR
            s = np.sin(2 * np.pi * midi(root) * tt) + 0.25 * np.sin(2 * np.pi * midi(root) * 2 * tt)
            bus.add(s * env(n, 0.004, 0.12), sec + BEAT / 2, 0.22)

    # hats: offbeat ticks from the start, sixteenths after the build
    if mood["hats"]:
        for k in range(int(round(tagline / (BEAT / 2)))):
            sec = k * BEAT / 2
            if k % 2 == 1:
                bus.add(hat(rng), sec, 0.05 if sec < drop else 0.08, pan=0.35)
            elif sec >= build:
                bus.add(hat(rng, 70), sec + BEAT / 4, 0.035, pan=-0.3)

    if mood["claps"]:
        for b in beats(build, tagline):
            if b % 2 == 1:
                bus.add(clap(rng), b * BEAT, 0.16)

    # risers into the drop and into the tagline
    bus.add(riser(rng, min(2.0, drop)), drop - min(2.0, drop), 0.22)
    bus.add(riser(rng, 1.5), tagline - 1.5, 0.18)

    # three tagline hits on the beat after the cut, then the logo boom on the CTA cut
    r = mood["hit_root"]
    for i, m in enumerate((r, r + 3, r + 7)):
        bus.add(tone_hit(K, m), tagline + BEAT + i * 2 * BEAT, 0.32)
    bus.add(tone_hit(K, r - 12, big=True), cta, 0.5)

    # bell motif over the CTA
    for k, m in enumerate((r + 12, r + 7, r + 10, r + 15)):
        start = cta + 1.0 + k * BEAT * 2
        if start > length - 1.2:
            break
        n = int(1.2 * SR)
        tt = np.arange(n) / SR
        bell = (np.sin(2 * np.pi * midi(m) * tt) + 0.4 * np.sin(2 * np.pi * midi(m) * 2.76 * tt)) * np.exp(-tt * 3)
        bus.add(bell, start, 0.07, pan=(-0.3, 0.3)[k % 2])

    mix = bus.stereo()
    n = bus.n
    fade = np.ones(n)
    fi = int(0.4 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    f0, f1 = int((length - 2.4) * SR), int((length - 0.2) * SR)
    fade[f0:f1] = np.linspace(1, 0, f1 - f0) ** 1.5
    fade[f1:] = 0
    mix *= fade[:, None]
    body = mix[int(drop * SR): int(tagline * SR)]
    rms = np.sqrt(np.mean(body ** 2))
    mix *= 10 ** (-16 / 20) / max(rms, 1e-9)
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix *= 0.95 / max(1e-9, np.abs(mix).max())
    return mix


# ---------------------------------------------------------------- sfx

def sfx_all():
    rng = np.random.default_rng(11)
    out = {}

    def tt(sec):
        return np.arange(int(sec * SR)) / SR

    # pop: a short pitched blip with a fast downward chirp
    t = tt(0.16)
    f = 900 * np.exp(-t * 18) + 380
    out["pop"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.8

    # click: a filtered noise tick plus a tiny body tone
    t = tt(0.06)
    x = rng.standard_normal(len(t))
    x = x - lowpass(x, 2500)
    out["click"] = (x * 0.5 + np.sin(2 * np.pi * 1800 * t) * 0.4) * np.exp(-t * 120)
    out["click-soft"] = lowpass(out["click"], 3000) * 0.7

    # whoosh: band-swept noise, swelling and dying
    t = tt(0.55)
    x = rng.standard_normal(len(t))
    sweep = 400 + 5000 * np.sin(np.pi * t / t[-1]) ** 2
    w = lowpass(x, sweep) - lowpass(x, sweep * 0.25)
    out["whoosh"] = w * np.sin(np.pi * t / t[-1]) ** 1.5 * 1.6

    # ping: bright bell, two partials
    t = tt(1.1)
    out["ping"] = (np.sin(2 * np.pi * 1568 * t) + 0.35 * np.sin(2 * np.pi * 1568 * 2.76 * t)) * np.exp(-t * 6) * 0.45

    # notification: two quick rising tones
    t = tt(0.5)
    a = np.sin(2 * np.pi * 1047 * t) * np.exp(-t * 14)
    b = np.zeros(len(t))
    k = int(0.11 * SR)
    b[k:] = np.sin(2 * np.pi * 1397 * t[: len(t) - k]) * np.exp(-t[: len(t) - k] * 10)
    out["notification"] = (a + b) * 0.4

    # typing: a run of soft key taps, 1.2 s
    t = tt(1.2)
    x = np.zeros(len(t))
    pos = 0.0
    while pos < 1.1:
        n = int(0.03 * SR)
        tap = rng.standard_normal(n)
        tap = (tap - lowpass(tap, 1800)) * np.exp(-np.arange(n) / SR * 160)
        i = int(pos * SR)
        x[i: i + n] += tap * (0.5 + 0.5 * rng.random())
        pos += 0.07 + 0.06 * rng.random()
    out["typing"] = x * 0.45

    # impact: deep kick with a noise transient and a low tone tail
    t = tt(1.3)
    f = 38 + 90 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    noise = rng.standard_normal(len(t))
    trans = lowpass(noise, 2500) * np.exp(-t * 40)
    out["impact"] = (body + trans * 0.5) * 0.9

    # sparkle: a quick shower of high bell grains
    t = tt(1.2)
    x = np.zeros(len(t))
    for k in range(9):
        start = 0.04 * k + 0.02 * rng.random()
        fr = 2200 + 2400 * rng.random()
        n = int(0.5 * SR)
        g = np.sin(2 * np.pi * fr * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 9)
        i = int(start * SR)
        x[i: i + n] += g[: len(x) - i] * 0.18
    out["sparkle"] = x

    # riser: swept noise over 1.5 s
    out["riser"] = riser(rng, 1.5) * 0.7

    for k, v in out.items():
        fi = min(len(v), int(0.002 * SR))
        v[:fi] *= np.linspace(0, 1, fi)
        v /= max(1e-9, np.abs(v).max())
        out[k] = v * 0.9
    return out


# ---------------------------------------------------------------- write

def write_mp3(samples, path, bitrate="192k"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = tmp.name
    try:
        sf.write(wav, samples.astype(np.float32), SR, subtype="PCM_16")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", bitrate, path],
            check=True,
        )
    finally:
        os.unlink(wav)


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    for name, sig in sfx_all().items():
        write_mp3(sig, os.path.join(out_dir, "sfx", f"{name}.mp3"), "128k")
        print(f"sfx   {name}")
    for mood in MOODS:
        for length in TIMING:
            write_mp3(bed(mood, length), os.path.join(out_dir, "music", f"{mood}-{length}.mp3"))
            print(f"music {mood}-{length}")


if __name__ == "__main__":
    main()
