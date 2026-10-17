"""All of a user's ended drives as CSV (Settings → Export drives)."""
from __future__ import annotations

import csv
import io
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TripState
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel

CSV_HEADER = [
    "date",
    "start_time",
    "end_time",
    "vehicle",
    "distance_km",
    "duration_min",
    "avg_speed_kmh",
    "top_speed_kmh",
    "score",
    "from",
    "to",
]


@dataclass
class ExportRow:
    start_time: datetime
    end_time: datetime | None
    vehicle: str
    distance_meters: float
    duration_seconds: int
    idle_seconds: int
    max_speed_mps: float | None
    score: int | None
    start_address: str | None
    end_address: str | None


def _num(value: float | None, digits: int) -> str:
    return "" if value is None else f"{value:.{digits}f}"


def trips_to_csv(rows: Iterable[ExportRow], zone: ZoneInfo) -> str:
    """CSV text, times in the user's zone; average speed is over moving time, as in the app."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(CSV_HEADER)
    for row in rows:
        start = row.start_time.astimezone(zone)
        end = row.end_time.astimezone(zone) if row.end_time else None
        moving = max(row.duration_seconds - row.idle_seconds, 0)
        distance = float(row.distance_meters)
        writer.writerow(
            [
                start.date().isoformat(),
                start.strftime("%H:%M"),
                end.strftime("%H:%M") if end else "",
                row.vehicle,
                _num(distance / 1000, 2),
                _num(row.duration_seconds / 60, 1),
                _num(distance / moving * 3.6 if moving > 0 else None, 1),
                _num(float(row.max_speed_mps) * 3.6 if row.max_speed_mps is not None else None, 1),
                "" if row.score is None else str(row.score),
                row.start_address or "",
                row.end_address or "",
            ]
        )
    return out.getvalue()


async def list_export_rows(db: AsyncSession, *, user_id: uuid.UUID) -> list[ExportRow]:
    vehicle_name = func.coalesce(Vehicle.name, VehicleCompany.name + " " + VehicleModel.name)
    result = await db.execute(
        select(
            Trip.start_time,
            Trip.end_time,
            vehicle_name,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.idle_time_seconds,
            Trip.max_speed_mps,
            Trip.driving_score,
            Trip.start_address,
            Trip.end_address,
        )
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
        .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
        .where(Trip.user_id == user_id, Trip.deleted_at.is_(None), Trip.state == TripState.ended)
        .order_by(Trip.start_time.desc())
    )
    return [ExportRow(*row) for row in result.all()]
