"""
Cut fixed-weight faces out of a variable font, for libass.

libass draws a variable font at its DEFAULT instance -- Roboto-Variable at
wght 400 -- and the ASS Bold flag does not select a heavier instance. Measured:
a headline style declaring Roboto with bold = -1 rendered visibly regular next
to the heavy grotesque in the reference frame. A static face at the wanted
weight is the only way to get that weight on screen.

Each output gets its own family name so several can sit in one fonts directory
without libass matching the wrong one, and its OS/2 weight and bold bits set so
libass does not synthesise extra emboldening on top.

    python scripts/make_static_fonts.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"

# (variable source, output file, family name, wght, wdth)
FACES = [
    ("Roboto-Variable.ttf", "Roboto-ExtraBold-Static.ttf", "Roboto ExtraBold Static", 800, 100),
    ("Roboto-Variable.ttf", "Roboto-SemiBold-Static.ttf", "Roboto SemiBold Static", 600, 100),
]


def make(source: str, dest: str, family: str, wght: int, wdth: int) -> Path:
    font = TTFont(ASSETS / source)
    static = instantiateVariableFont(font, {"wght": wght, "wdth": wdth})

    names = static["name"]
    for rec in list(names.names):
        # Typographic family/subfamily would group this back with the source.
        if rec.nameID in (16, 17, 21, 22):
            names.removeNames(nameID=rec.nameID)
    postscript = family.replace(" ", "") + "-Regular"
    for name_id, value in ((1, family), (2, "Regular"), (4, family),
                           (6, postscript)):
        names.setName(value, name_id, 3, 1, 0x409)
        names.setName(value, name_id, 1, 0, 0)

    # Weight recorded for matching; the style bits stay "Regular" because the
    # family name already IS the weight, and a bold bit here would make libass
    # treat an ASS Bold = 0 request as a mismatch.
    static["OS/2"].usWeightClass = wght

    out = ASSETS / dest
    static.save(out)
    return out


def main() -> int:
    for spec in FACES:
        out = make(*spec)
        print(f"wrote {out.name} ({spec[2]}, wght {spec[3]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
