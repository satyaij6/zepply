"""
Screen-recording detection must fire on a webcam overlay and on nothing else.

The cost of a false positive is a podcast rendered as a tiny screen over a
stretched face, so most of these tests are about NOT firing.
"""
from clipper.config import Settings
from clipper.reframe import build_span_graph
from clipper.reframe.detect import Detections, Face, Sample
from clipper.reframe.screen import detect_layout, plan_for_span, panel_heights

W, H = 854, 480


def _det(boxes, n=50):
    """Detections where every sample carries the given (x, y, w, h) faces."""
    samples = [Sample(t=i * 0.2, faces=[Face(x, y, w, h, 0.9) for x, y, w, h in boxes])
               for i in range(n)]
    return Detections(width=W, height=H, fps=25.0, duration=n * 0.2, samples=samples)


def test_small_static_corner_face_is_a_screen_recording():
    det = _det([(720, 400, 24, 30)])   # bottom-right, 6% of height
    layout = detect_layout(det, Settings(), scale=1.0, forced=False)
    assert layout is not None and layout.face is not None


def test_two_person_podcast_is_not():
    det = _det([(180, 120, 90, 110), (560, 130, 85, 105)])
    assert detect_layout(det, Settings(), scale=1.0, forced=False) is None


def test_a_wide_shot_with_a_small_central_face_is_not():
    det = _det([(410, 150, 30, 40)])   # small, but mid-frame
    assert detect_layout(det, Settings(), scale=1.0, forced=False) is None


def test_no_faces_is_not_a_screen_recording_unless_forced():
    det = _det([])
    assert detect_layout(det, Settings(), scale=1.0, forced=False) is None
    forced = detect_layout(det, Settings(), scale=1.0, forced=True)
    assert forced is not None and forced.face is None


def test_face_box_is_scaled_to_source_pixels():
    det = _det([(720, 400, 24, 30)])
    layout = detect_layout(det, Settings(), scale=2.0, forced=False)
    assert layout.face == (1440, 800, 48, 60)


def test_panels_fill_the_video_rect_exactly():
    s = Settings()
    top, bottom = panel_heights(s, 1920, 1080, True)
    assert top + bottom == s.video_h
    assert top % 2 == 0
    only, none = panel_heights(s, 1920, 1080, False)
    assert none == 0 and only <= s.video_h


def test_screen_plan_builds_a_graph_with_and_without_a_face():
    s = Settings()
    det = _det([(720, 400, 24, 30)])
    layout = detect_layout(det, s, scale=1920 / W, forced=False)
    for lay in (layout, detect_layout(_det([]), s, scale=1.0, forced=True)):
        fp = plan_for_span(lay, duration=8, fps=25, source_w=1920, source_h=1080, settings=s)
        assert [r.kind for r in fp.runs] == ["screen"] and not fp.fallback
        parts, out, used = build_span_graph(fp, s, first_input=0, label="s0", fps=25)
        graph = ";".join(parts)
        assert used == 1 and out == "s0cat"
        assert ("vstack" in graph) == (lay.face is not None)
        assert ("boxblur" in graph) == (lay.face is None)
