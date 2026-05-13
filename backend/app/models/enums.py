from __future__ import annotations

import enum


class FuelType(str, enum.Enum):
    petrol = "petrol"
    diesel = "diesel"
    cng = "cng"
    lpg = "lpg"
    electric = "electric"
    hybrid = "hybrid"
    other = "other"


class TripState(str, enum.Enum):
    idle = "idle"
    started = "started"
    active = "active"
    paused = "paused"
    ended = "ended"

