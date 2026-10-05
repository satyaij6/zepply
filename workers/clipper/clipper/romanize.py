"""
Deterministic Telugu -> Latin romanization, offline and free.

This exists because the pipeline romanizes for two different consumers and only
one of them needs Sarvam:

* **The forced aligner** needs a phonetic Latin form for CTC matching. It does
  not care whether బెస్ట్ comes back as "Best" or "besT" -- it matches sounds.
* **The captions** need Sarvam's real value: rendering English loanwords back as
  English rather than phonetically.

Measured on test1, captions cover 246 of 1,211 distinct words -- 20%. Sending
the whole transcript to Sarvam therefore pays roughly 5x what the captions
actually need, puts a serial network stage on the critical path, and is what
provoked the rate limiting on a 70-minute source.

The mapping targets the MMS_FA alphabet (27 Latin letters plus apostrophe), so
distinctions that alphabet cannot represent are deliberately collapsed:
retroflex to dental, aspirates to consonant+h. For CTC alignment that loss is
irrelevant -- the acoustic model is matching approximate phonetics, not
producing readable text.
"""
from __future__ import annotations

# Independent vowels.
VOWELS = {
    "అ": "a", "ఆ": "aa", "ఇ": "i", "ఈ": "ii",
    "ఉ": "u", "ఊ": "uu", "ఋ": "ru", "ౠ": "ruu",
    "ఌ": "lu", "ౡ": "luu",
    "ఎ": "e", "ఏ": "ee", "ఐ": "ai",
    "ఒ": "o", "ఓ": "oo", "ఔ": "au",
}

# Dependent vowel signs (matras), same values as their independent forms.
MATRAS = {
    "ా": "aa", "ి": "i", "ీ": "ii", "ు": "u",
    "ూ": "uu", "ృ": "ru", "ౄ": "ruu",
    "ె": "e", "ే": "ee", "ై": "ai",
    "ొ": "o", "ో": "oo", "ౌ": "au",
    "ౕ": "", "ౖ": "",          # length marks, no segmental value
}

# Consonants. Retroflex collapses to dental and aspirates to +h, because the
# aligner's alphabet has no way to express either distinction.
CONSONANTS = {
    "క": "k", "ఖ": "kh", "గ": "g", "ఘ": "gh", "ఙ": "n",
    "చ": "ch", "ఛ": "chh", "జ": "j", "ఝ": "jh", "ఞ": "n",
    "ట": "t", "ఠ": "th", "డ": "d", "ఢ": "dh", "ణ": "n",
    "త": "t", "థ": "th", "ద": "d", "ధ": "dh", "న": "n",
    "ప": "p", "ఫ": "ph", "బ": "b", "భ": "bh", "మ": "m",
    "య": "y", "ర": "r", "ఱ": "r", "ల": "l", "ళ": "l",
    "ఴ": "l", "వ": "v",
    "శ": "sh", "ష": "sh", "స": "s", "హ": "h",
}

VIRAMA = "్"
ANUSVARA = "ం"      # nasalisation
VISARGA = "ః"
CANDRABINDU = "ఁ"

DIGITS = {chr(0x0C66 + n): str(n) for n in range(10)}


def is_telugu(text: str) -> bool:
    return any("ఀ" <= c <= "౿" for c in text)


def romanize(word: str) -> str:
    """
    Phonetic Latin for one Telugu word.

    A consonant carries an inherent 'a' unless a virama or a matra follows --
    that rule is the whole of Indic orthography, and getting it wrong inserts or
    drops a vowel in almost every syllable.
    """
    out: list[str] = []
    i = 0
    n = len(word)
    while i < n:
        ch = word[i]
        if ch in CONSONANTS:
            out.append(CONSONANTS[ch])
            nxt = word[i + 1] if i + 1 < n else ""
            if nxt == VIRAMA:
                i += 2                       # conjunct or final: no vowel
                continue
            if nxt in MATRAS:
                out.append(MATRAS[nxt])
                i += 2
                continue
            out.append("a")                  # inherent vowel
            i += 1
            continue
        if ch in VOWELS:
            out.append(VOWELS[ch])
        elif ch in (ANUSVARA, CANDRABINDU):
            out.append("n")
        elif ch == VISARGA:
            out.append("h")
        elif ch in DIGITS:
            out.append(DIGITS[ch])
        elif ch in MATRAS:
            out.append(MATRAS[ch])           # stray matra; keep the vowel
        elif not ("ఀ" <= ch <= "౿"):
            out.append(ch)                   # already Latin, punctuation, digits
        i += 1
    return "".join(out)


def romanize_words(words: list[str]) -> list[str]:
    """
    One output per input, always.

    Same invariant as the Sarvam path: word indices carry the timings, so a
    changed count would desynchronise every caption after it.
    """
    return [romanize(w) if is_telugu(w) else w for w in words]
