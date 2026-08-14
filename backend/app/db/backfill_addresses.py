"""Reverse-geocode trips that predate address storage.

Run once after deploying the addresses migration:

    docker compose exec backend python -m app.db.backfill_addresses
    docker compose exec backend python -m app.db.backfill_addresses --limit 200 --delay 1.5

Idempotent: every processed trip gets `geocoded_at` stamped, so a re-run only picks up what is
still outstanding. Safe to interrupt — progress is committed per trip.
"""
from __future__ import annotations

import argparse
import asyncio
import logging

import httpx
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.trip import Trip
from app.services.geocoding_service import USER_AGENT, resolve_trip_addresses

logger = logging.getLogger("backfill_addresses")

#: Photon's public instance is a free community service. One request per second per endpoint is
#: well inside fair use; raise `--delay` rather than lower it if operators ever push back.
DEFAULT_DELAY_SECONDS = 1.0


async def backfill(*, limit: int | None, delay_seconds: float) -> int:
    settings = get_settings()
    processed = 0

    async with SessionLocal() as session:
        stmt = (
            select(Trip.id)
            .where(
                Trip.geocoded_at.is_(None),
                Trip.deleted_at.is_(None),
                Trip.end_time.is_not(None),
            )
            .order_by(Trip.end_time.desc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        trip_ids = list((await session.execute(stmt)).scalars().all())

        if not trip_ids:
            logger.info("No trips awaiting reverse geocoding.")
            return 0

        logger.info("Reverse geocoding %d trip(s)...", len(trip_ids))
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}) as client:
            for index, trip_id in enumerate(trip_ids):
                trip = await resolve_trip_addresses(
                    session, trip_id=trip_id, client=client, settings=settings
                )
                processed += 1
                if trip is not None:
                    logger.info(
                        "[%d/%d] %s: %s -> %s",
                        index + 1,
                        len(trip_ids),
                        trip_id,
                        trip.start_address or "unknown",
                        trip.end_address or "unknown",
                    )
                # Sleep between trips, not after the last one.
                if delay_seconds > 0 and index < len(trip_ids) - 1:
                    await asyncio.sleep(delay_seconds)

    logger.info("Done. Processed %d trip(s).", processed)
    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Reverse-geocode trip start/end addresses via Photon.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum trips to process this run.")
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help=f"Seconds to wait between trips (default {DEFAULT_DELAY_SECONDS}).",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(backfill(limit=args.limit, delay_seconds=args.delay))


if __name__ == "__main__":
    main()
