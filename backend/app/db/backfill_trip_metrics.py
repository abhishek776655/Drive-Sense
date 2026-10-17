"""Compute turns (and a GPS G-force estimate where none is stored) for ended trips that predate them.

Run once after deploying the turns migration:

    docker compose exec backend python -m app.db.backfill_trip_metrics

Picks up ended trips with no turn counts yet, so a re-run only does what is outstanding. Safe to
interrupt: progress is committed every batch. Supersedes `backfill_g_force` (it also sets G).
"""
from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.trip import Trip
from app.services.trip_service import apply_track_metrics

logger = logging.getLogger("backfill_trip_metrics")
COMMIT_EVERY = 50


async def backfill(*, limit: int | None) -> int:
    async with SessionLocal() as session:
        stmt = (
            select(Trip)
            .where(Trip.left_turns.is_(None), Trip.deleted_at.is_(None), Trip.end_time.is_not(None))
            .order_by(Trip.end_time.desc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        trips = list((await session.execute(stmt)).scalars().all())
        logger.info("Computing turns for %d trip(s)...", len(trips))
        for index, trip in enumerate(trips, start=1):
            await apply_track_metrics(session, trip)
            if index % COMMIT_EVERY == 0:
                await session.commit()
        await session.commit()
    logger.info("Done.")
    return len(trips)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Only process the newest N trips")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(backfill(limit=args.limit))


if __name__ == "__main__":
    main()
