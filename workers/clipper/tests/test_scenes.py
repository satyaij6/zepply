"""
Choppy stretches of the SOURCE must lose at selection time.

The reframe follows the source: when the editor intercuts two camera angles
every 1.5s, the reel cuts every 1.5s too. Each shot is framed correctly, so
there is nothing downstream to fix -- `min_run` cannot merge across a source
cut because the person is not in the next frame at all. Selection is the only
stage that can prevent it.

Measured on a real 70-minute source: 626 cuts, 9/min average, and the clip a
viewer reported as flashing scored 15.3 cuts/min -- the choppiest of the three
rendered. The penalty exists to stop that region winning in the first place.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings
from clipper.scenes import choppiness_factor, cuts_per_minute


def test_no_cuts_is_no_penalty():
    assert cuts_per_minute([], 0.0, 60.0) == 0.0
    assert choppiness_factor(0.0, Settings()) == 1.0


def test_rate_counts_only_cuts_inside_the_window():
    cuts = [1.0, 5.0, 9.0, 100.0, 200.0]
    # Three cuts in a 60s window.
    assert cuts_per_minute(cuts, 0.0, 60.0) == pytest.approx(3.0)
    # The window boundaries are inclusive of cuts landing on them.
    assert cuts_per_minute(cuts, 95.0, 155.0) == pytest.approx(1.0)


def test_rate_scales_with_window_length():
    cuts = [float(i) for i in range(0, 30)]   # one per second
    assert cuts_per_minute(cuts, 0.0, 30.0) == pytest.approx(60.0, rel=0.1)


def test_a_zero_length_window_is_not_a_division_by_zero():
    assert cuts_per_minute([1.0, 2.0], 5.0, 5.0) == 0.0


def test_a_calm_region_is_untouched():
    s = Settings()
    assert choppiness_factor(s.max_cuts_per_minute - 0.1, s) == 1.0
    assert choppiness_factor(0.0, s) == 1.0


def test_the_penalty_grows_with_the_cut_rate():
    s = Settings()
    calm = choppiness_factor(s.max_cuts_per_minute, s)
    busy = choppiness_factor(s.max_cuts_per_minute * 2, s)
    frantic = choppiness_factor(s.max_cuts_per_minute * 4, s)
    assert calm == 1.0
    assert busy < calm and frantic < busy


def test_double_the_limit_scores_half():
    """The default exponent of 1.0 makes the decay easy to reason about."""
    s = Settings(max_cuts_per_minute=10.0, cut_penalty=1.0)
    assert choppiness_factor(20.0, s) == pytest.approx(0.5)
    assert choppiness_factor(40.0, s) == pytest.approx(0.25)


def test_the_measured_flashing_clip_is_penalised():
    """15.3 cuts/min is the clip a viewer reported; it must lose ground."""
    s = Settings()
    assert choppiness_factor(15.3, s) < 0.7


def test_a_calm_clip_from_the_same_source_is_not():
    """5.8 and 6.8 cuts/min were the two clips nobody complained about."""
    s = Settings()
    assert choppiness_factor(5.8, s) == 1.0
    assert choppiness_factor(6.8, s) == 1.0


def test_the_penalty_can_be_switched_off():
    s = Settings(cut_penalty=0.0)
    assert choppiness_factor(100.0, s) == 1.0


def test_a_nonsensical_limit_does_not_explode():
    s = Settings(max_cuts_per_minute=0.0)
    assert choppiness_factor(50.0, s) == 1.0
