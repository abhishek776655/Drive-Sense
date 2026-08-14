"""Reverse geocoding for trip endpoints, backed by Photon (Komoot's OpenStreetMap geocoder).

Everything that decides *what* an address reads like is a pure function here, so the formatting
rules are unit-testable without a network. Only `reverse_geocode` touches HTTP.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.location_point import LocationPoint
from app.models.trip import Trip

logger = logging.getLogger(__name__)

#: Photon asks callers to identify themselves so its operators can reach out about heavy usage.
USER_AGENT = "DriveSense/1.0 (+https://github.com/Abhishek-DC/DriveSense)"

#: Address column width. Longer results are trimmed rather than rejected.
MAX_ADDRESS_LENGTH = 255

#: Photon property keys that can name the specific place, best first.
_PLACE_KEYS = ("name", "street", "district", "locality", "suburb")
#: Photon property keys that place it in a wider area, best first.
_AREA_KEYS = ("city", "town", "village", "county", "state")


def format_photon_address(properties: dict | None) -> str | None:
    """Turn a Photon feature's properties into one short human-readable line.

    Aims for "<place>, <area>" — "Indiranagar, Bengaluru" — rather than a full postal address,
    because this is read on a trip card at caption size. Returns ``None`` when the response carries
    nothing nameable, which is the honest answer for a point in open country.
    """
    if not properties:
        return None

    place = next((str(properties[key]).strip() for key in _PLACE_KEYS if properties.get(key)), None)
    area = next((str(properties[key]).strip() for key in _AREA_KEYS if properties.get(key)), None)

    # A house number is only meaningful attached to its street, never on its own.
    if place and properties.get("housenumber") and properties.get("street") and place == str(properties["street"]).strip():
        place = f"{properties['housenumber']} {place}"

    parts = [part for part in (place, area) if part]
    if not parts:
        # Nothing local resolved; a country alone is better than showing raw coordinates.
        country = properties.get("country")
        if not country:
            return None
        parts = [str(country).strip()]

    # "Bengaluru, Bengaluru" reads like a bug even though both fields were populated.
    deduped: list[str] = []
    for part in parts:
        if part and part.casefold() not in {existing.casefold() for existing in deduped}:
            deduped.append(part)

    return ", ".join(deduped)[:MAX_ADDRESS_LENGTH] or None


def extract_first_feature_properties(payload: dict | None) -> dict | None:
    """Pull the properties of the closest match out of a Photon GeoJSON response."""
    if not payload:
        return None
    features = payload.get("features")
    if not isinstance(features, list) or not features:
        return None
    first = features[0]
    if not isinstance(first, dict):
        return None
    properties = first.get("properties")
    return properties if isinstance(properties, dict) else None


async def reverse_geocode(
    client: httpx.AsyncClient,
    *,
    latitude: float,
    longitude: float,
    settings: Settings | None = None,
) -> str | None:
    """Resolve one coordinate to an address label, or ``None`` if Photon cannot or will not.

    Never raises: a geocoding miss must not fail the trip it decorates.
    """
    resolved_settings = settings or get_settings()
    try:
        response = await client.get(
            f"{resolved_settings.photon_base_url.rstrip('/')}/reverse",
            params={"lat": latitude, "lon": longitude, "lang": resolved_settings.photon_language},
            headers={"User-Agent": USER_AGENT},
            timeout=resolved_settings.photon_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("Photon reverse geocode failed for %s,%s: %s", latitude, longitude, error)
        return None

    return format_photon_address(extract_first_feature_properties(payload))


async def _get_trip_endpoints(
    db: AsyncSession,
    trip_id: uuid.UUID,
) -> tuple[LocationPoint | None, LocationPoint | None]:
    """The trip's first and last recorded points. Both are ``None`` for a trip with no points."""
    first = (
        await db.execute(
            select(LocationPoint)
            .where(LocationPoint.trip_id == trip_id)
            .order_by(LocationPoint.recorded_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if first is None:
        return None, None

    last = (
        await db.execute(
            select(LocationPoint)
            .where(LocationPoint.trip_id == trip_id)
            .order_by(LocationPoint.recorded_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return first, last


async def resolve_trip_addresses(
    db: AsyncSession,
    *,
    trip_id: uuid.UUID,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> Trip | None:
    """Reverse-geocode a trip's endpoints and persist them.

    Stamps `geocoded_at` whatever the outcome, so a trip that resolves to nothing is not retried on
    every future backfill. Returns the trip, or ``None`` if it no longer exists.
    """
    resolved_settings = settings or get_settings()
    trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if trip is None:
        return None

    first, last = await _get_trip_endpoints(db, trip_id)
    if first is None or last is None:
        trip.geocoded_at = datetime.now(timezone.utc)
        await db.commit()
        return trip

    owns_client = client is None
    active_client = client or httpx.AsyncClient()
    try:
        start_address = await reverse_geocode(
            active_client, latitude=first.latitude, longitude=first.longitude, settings=resolved_settings
        )
        # A round trip that ends where it started needs one lookup, not two.
        if last.id == first.id:
            end_address = start_address
        else:
            end_address = await reverse_geocode(
                active_client, latitude=last.latitude, longitude=last.longitude, settings=resolved_settings
            )
    finally:
        if owns_client:
            await active_client.aclose()

    trip.start_address = start_address
    trip.end_address = end_address
    trip.geocoded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trip)
    return trip


async def geocode_trip_in_background(trip_id: uuid.UUID) -> None:
    """Entry point for FastAPI background tasks: owns its own session and swallows every failure.

    The request that scheduled this has already returned, so an exception here would only surface as
    an unhandled task error in the logs and must never be allowed to take anything else down.
    """
    settings = get_settings()
    if not settings.reverse_geocoding_enabled:
        return

    # Imported here so importing this module never constructs an engine at import time.
    from app.db.session import SessionLocal

    try:
        async with SessionLocal() as session:
            await resolve_trip_addresses(session, trip_id=trip_id, settings=settings)
    except (asyncio.CancelledError, KeyboardInterrupt):
        raise
    except Exception:
        logger.exception("Background reverse geocoding failed for trip %s", trip_id)
