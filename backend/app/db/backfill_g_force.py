"""Estimate max G-force for ended trips recorded before G-force was stored.

Run once after deploying the G-force migration:

    docker compose exec backend python -m app.db.backfill_g_force

Uses each trip's stored GPS speeds (`max_g_source = 'gps'`), the same estimate a trip without
sensor data gets when it ends. Trips with no usable speed pairs are marked `gps-none` so a re-run
skips them. Idempotent and safe to interrupt: progress is committed per batch.
"""
from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.services.g_force_service import estimate_max_g_from_speeds

logger = logging.getLogger("backfill_g_force")
COMMIT_EVERY = 50


async def backfill(*, limit: int | None) -> int:
    updated = 0
    async with SessionLocal() as session:
        stmt = (
            select(Trip)
            .where(Trip.max_g_force.is_(None), Trip.max_g_source.is_(None), Trip.deleted_at.is_(None), Trip.end_time.is_not(None))
            .order_by(Trip.end_time.desc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        trips = list((await session.execute(stmt)).scalars().all())
        logger.info("Estimating max G for %d trip(s)...", len(trips))
        for index, trip in enumerate(trips, start=1):
            speeds = (
                await session.execute(
                    select(LocationPoint.recorded_at, LocationPoint.speed_mps)
                    .where(LocationPoint.trip_id == trip.id)
                    .order_by(LocationPoint.recorded_at, LocationPoint.id)
                )
            ).all()
            estimate = estimate_max_g_from_speeds(speeds)
            if estimate is None:
                trip.max_g_source = "gps-none"
            else:
                trip.max_g_force = estimate
                trip.max_g_source = "gps"
                updated += 1
            if index % COMMIT_EVERY == 0:
                await session.commit()
        await session.commit()
    logger.info("Done: %d trip(s) got an estimate.", updated)
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Only process the newest N trips")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(backfill(limit=args.limit))


if __name__ == "__main__":
    main()
