"""
A panel must not straddle a composite source's join.

Podcast footage is often two camera feeds laid side by side with a flat strip
between them. The reframe assumed one camera filling the frame, so a panel was
sized and placed without regard for the join: measured on real footage the left
panel spanned x=62..659 against a divider at x=595..601, putting 58px of the
neighbouring camera down the right edge of the top panel.

Two separate failures had to be fixed, and both are pinned here:

* the panel was WIDER than its pane (596.6 vs 595), so no placement could
  avoid the join;
* it was centred on the lock's cluster median (x=360) rather than where the
  face actually was in this shot (x=240), because the median averages across
  source layouts.

The no-divider case must stay bit-for-bit unchanged -- single-camera sources
are the common case.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings
from clipper.reframe.panes import divider_in_frame, pane_for
from clipper.reframe.path import Lock, build_panels, panel_width

W, H = 1280, 720
DIVIDER = (595.0, 601.0)


def composite_frame(divider_x: int = 595, width: int = 6,
                    frame_w: int = W) -> np.ndarray:
    """Two noisy panes with a flat strip between them."""
    rng = np.random.default_rng(0)
    img = rng.integers(0, 255, size=(H, frame_w, 3), dtype=np.uint8)
    img[:, divider_x:divider_x + width] = 225
    return img


def test_a_composite_frame_yields_its_divider():
    got = divider_in_frame(composite_frame())
    assert got is not None
    lo, hi = got
    assert 594 <= lo <= 596 and 600 <= hi <= 602, got


def test_a_single_camera_frame_has_no_divider():
    rng = np.random.default_rng(1)
    img = rng.integers(0, 255, size=(H, W, 3), dtype=np.uint8)
    assert divider_in_frame(img) is None


def test_a_wide_flat_region_is_not_a_divider():
    """A blown-out wall is flat too, and must not be mistaken for a join."""
    img = composite_frame(divider_x=500, width=200)
    assert divider_in_frame(img) is None


def test_an_off_centre_strip_is_not_a_divider():
    """Two panes are never wildly lopsided; an edge strip is background."""
    img = composite_frame(divider_x=40, width=6)
    assert divider_in_frame(img) is None


def test_two_candidate_strips_are_rejected():
    """Ambiguity means whatever is being measured is not a two-pane join."""
    img = composite_frame(divider_x=520, width=6)
    img[:, 700:706] = 225
    assert divider_in_frame(img) is None


def test_pane_for_maps_a_face_to_its_own_side():
    assert pane_for(240, DIVIDER, source_w=W) == (0.0, 595.0)
    assert pane_for(982, DIVIDER, source_w=W) == (601.0, 1280.0)


def test_pane_for_without_a_divider_is_the_whole_frame():
    assert pane_for(240, None, source_w=W) == (0.0, float(W))


# ---------------------------------------------------------------- sizing

def locks_at(*positions: float) -> dict[int, list[Lock]]:
    return {
        n: [Lock(identity=n, framing=0, face_cx=x, face_cy=300.0,
                 ranges=[(0.0, 60.0)], samples=500)]
        for n, x in enumerate(positions)
    }


def test_panel_width_is_bounded_by_the_narrower_pane():
    """596.6 into a 595px pane is what put the join inside the panel."""
    locks = locks_at(360.0, 982.0)
    unbounded = panel_width(locks, source_w=W, source_h=H, settings=Settings())
    bounded = panel_width(locks, source_w=W, source_h=H, settings=Settings(),
                          divider=DIVIDER)
    assert unbounded > 595.0, unbounded
    assert bounded <= 595.0, bounded


def test_panel_width_without_a_divider_is_unchanged():
    locks = locks_at(360.0, 982.0)
    assert (panel_width(locks, source_w=W, source_h=H, settings=Settings())
            == panel_width(locks, source_w=W, source_h=H, settings=Settings(),
                           divider=None))


# ------------------------------------------------------------- placement

class FakeSeen:
    """Visibility stub: reports where each face really is at time t."""

    def __init__(self, positions: dict[int, float]):
        self.positions = positions

    def face_at(self, identity: int, t: float):
        x = self.positions.get(identity)
        if x is None:
            return None
        return type("F", (), {"cx": x, "cy": 300.0})()


def test_panels_stay_inside_their_own_pane():
    """The measured case: nothing may cross x=595..601."""
    locks = locks_at(360.0, 982.0)
    panels = build_panels(locks, 1.0, source_w=W, source_h=H,
                          settings=Settings(), seen=None, width=None,
                          divider=DIVIDER)
    assert len(panels) == 2
    left, right = panels
    assert left.crop_x >= 0.0
    assert left.crop_x + left.crop_w <= DIVIDER[0] + 0.01, (
        f"left panel {left.crop_x}..{left.crop_x + left.crop_w} crosses the join")
    assert right.crop_x >= DIVIDER[1] - 0.01, (
        f"right panel starts at {right.crop_x}, inside the join")
    assert right.crop_x + right.crop_w <= W + 0.01


def test_panels_follow_the_face_not_the_cluster_median():
    """
    The lock median is 360; in THIS shot the face is at 240.

    Centring on the median put the face 28% from the panel edge.
    """
    locks = locks_at(360.0, 982.0)
    seen = FakeSeen({0: 240.0, 1: 982.0})
    panels = build_panels(locks, 1.0, source_w=W, source_h=H,
                          settings=Settings(), seen=seen, width=None,
                          divider=DIVIDER)
    left = panels[0]
    centre = left.crop_x + left.crop_w / 2
    # The face should be far nearer the panel centre than the median would put it.
    assert abs(centre - 240.0) < abs(centre - 360.0) or left.crop_x == 0.0
    # And still inside its pane.
    assert left.crop_x + left.crop_w <= DIVIDER[0] + 0.01


def test_no_divider_keeps_the_previous_placement():
    """Single-camera sources must frame exactly as they did before."""
    locks = locks_at(360.0, 982.0)
    panels = build_panels(locks, 1.0, source_w=W, source_h=H,
                          settings=Settings(), seen=None, width=None,
                          divider=None)
    assert len(panels) == 2
    width = panels[0].crop_w
    expected = min(max(360.0 - width / 2, 0.0), max(W - width, 0.0))
    assert panels[0].crop_x == pytest.approx(expected)
