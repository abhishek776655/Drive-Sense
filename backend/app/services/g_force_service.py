"""Trip G-force: the phone's motion-sensor peak when it sent one, else an estimate from GPS speed."""
from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

GRAVITY_MPS2 = 9.81
# Consecutive fixes further apart than this say little about a single brake or launch.
MAX_GAP_SECONDS = 5.0
# Fixes closer than this make dv/dt noisy enough to invent jolts.
MIN_GAP_SECONDS = 0.5
# No road car reaches this from braking or accelerating; anything above is GPS speed noise.
MAX_PLAUSIBLE_G = 1.5
# Below this the speed barely changed between fixes: no measurement, not a real 0 g.
MIN_MEANINGFUL_G = 0.02


class SpeedPoint(Protocol):
    recorded_at: datetime
    speed_mps: float | None


def estimate_max_g_from_speeds(points: Sequence[SpeedPoint]) -> float | None:
    """Largest longitudinal acceleration between consecutive fixes, in g; None without usable pairs.

    GPS sees only speeding up and slowing down (not cornering), so this undercounts what a sensor
    would report. That is why trips keep the source and Home marks these values as estimates.
    """
    best: float | None = None
    for previous, current in zip(points, points[1:]):
        if previous.speed_mps is None or current.speed_mps is None:
            continue
        dt = (current.recorded_at - previous.recorded_at).total_seconds()
        if dt < MIN_GAP_SECONDS or dt > MAX_GAP_SECONDS:
            continue
        g = abs(current.speed_mps - previous.speed_mps) / dt / GRAVITY_MPS2
        if g > MAX_PLAUSIBLE_G:
            continue
        best = g if best is None else max(best, g)
    return best if best is not None and best >= MIN_MEANINGFUL_G else None


def merge_sensor_peak(current_max: float | None, batch_peaks: Sequence[float | None]) -> float | None:
    """The trip's sensor maximum after a batch of points; unchanged when the batch has none."""
    peaks = [peak for peak in batch_peaks if peak is not None]
    if not peaks:
        return current_max
    batch_max = max(peaks)
    return batch_max if current_max is None else max(current_max, batch_max)
