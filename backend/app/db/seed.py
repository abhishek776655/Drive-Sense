from __future__ import annotations

import asyncio
import math
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.db.bootstrap import ensure_local_schema
from app.models.enums import FuelType, TripState
from app.models.event import Event
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle


@dataclass(frozen=True)
class VehicleSeed:
    name: str
    plate_number: str
    fuel_type: FuelType
    tank_capacity_liters: float | None
    mileage_baseline_km_per_l: float | None


@dataclass(frozen=True)
class EventSeed:
    event_type: str
    minute_offset: int
    intensity: float
    payload: dict


@dataclass(frozen=True)
class TripSeed:
    vehicle_name: str
    start_time: datetime
    duration_minutes: int
    route: list[tuple[float, float]]
    idle_time_seconds: int
    fuel_used_liters: float
    cost_amount: float
    avg_speed_mps: float
    max_speed_mps: float
    driving_score: int
    events: list[EventSeed]


DEMO_EMAIL = "demo@drivesense.com"
DEMO_PASSWORD = "password123"

VEHICLE_SEEDS = [
    VehicleSeed(
        name="Honda City",
        plate_number="DL 10 AB 1234",
        fuel_type=FuelType.petrol,
        tank_capacity_liters=40,
        mileage_baseline_km_per_l=16.5,
    ),
    VehicleSeed(
        name="Hyundai Creta",
        plate_number="UP 16 CD 5678",
        fuel_type=FuelType.diesel,
        tank_capacity_liters=50,
        mileage_baseline_km_per_l=18.2,
    ),
    VehicleSeed(
        name="Tata Nexon EV",
        plate_number="DL 8C AX 8910",
        fuel_type=FuelType.electric,
        tank_capacity_liters=None,
        mileage_baseline_km_per_l=None,
    ),
    VehicleSeed(
        name="Maruti Swift",
        plate_number="HR 26 EF 2244",
        fuel_type=FuelType.cng,
        tank_capacity_liters=37,
        mileage_baseline_km_per_l=24.0,
    ),
    VehicleSeed(
        name="Mahindra XUV700",
        plate_number="DL 12 GH 7788",
        fuel_type=FuelType.diesel,
        tank_capacity_liters=60,
        mileage_baseline_km_per_l=14.8,
    ),
]


def _route_distance_meters(route: list[tuple[float, float]]) -> float:
    def to_rad(value: float) -> float:
        return math.radians(value)

    total = 0.0
    earth_radius = 6371000
    for index in range(1, len(route)):
        lat1, lng1 = route[index - 1]
        lat2, lng2 = route[index]
        delta_lat = to_rad(lat2 - lat1)
        delta_lng = to_rad(lng2 - lng1)
        start_lat = to_rad(lat1)
        end_lat = to_rad(lat2)
        arc = (
            (math.sin(delta_lat / 2) ** 2)
            + math.cos(start_lat)
            * math.cos(end_lat)
            * (math.sin(delta_lng / 2) ** 2)
        )
        total += 2 * earth_radius * math.atan2(math.sqrt(arc), math.sqrt(1 - arc))
    return total


base_time = datetime.now(timezone.utc) - timedelta(days=6)

TRIP_SEEDS = [
    TripSeed(
        vehicle_name="Honda City",
        start_time=base_time.replace(hour=4, minute=5, second=0, microsecond=0),
        duration_minutes=46,
        route=[
            (28.62892, 77.36486),
            (28.62831, 77.36174),
            (28.62712, 77.35641),
            (28.62544, 77.34987),
            (28.62342, 77.34155),
            (28.62098, 77.33186),
            (28.61888, 77.31642),
            (28.62194, 77.29274),
            (28.62796, 77.24264),
            (28.63148, 77.21983),
        ],
        idle_time_seconds=240,
        fuel_used_liters=1.5,
        cost_amount=162.0,
        avg_speed_mps=8.7,
        max_speed_mps=21.5,
        driving_score=92,
        events=[
            EventSeed("overspeed", 12, 1.08, {"speed_mps": 30.1, "speed_kph": 108.4, "threshold_mps": 27.78}),
            EventSeed("rapid_acceleration", 18, 1.11, {"acceleration_mps2": 3.34, "threshold_mps2": 3.0}),
            EventSeed("harsh_brake", 32, 1.04, {"acceleration_mps2": -3.64, "threshold_mps2": -3.5}),
        ],
    ),
    TripSeed(
        vehicle_name="Honda City",
        start_time=base_time.replace(hour=11, minute=40, second=0, microsecond=0),
        duration_minutes=34,
        route=[
            (28.63148, 77.21983),
            (28.62874, 77.23621),
            (28.62496, 77.25248),
            (28.62094, 77.27591),
            (28.61827, 77.30768),
            (28.62174, 77.33154),
            (28.62644, 77.35447),
            (28.62892, 77.36486),
        ],
        idle_time_seconds=110,
        fuel_used_liters=1.1,
        cost_amount=119.0,
        avg_speed_mps=10.2,
        max_speed_mps=23.7,
        driving_score=95,
        events=[
            EventSeed("harsh_brake", 20, 1.02, {"acceleration_mps2": -3.57, "threshold_mps2": -3.5}),
        ],
    ),
    TripSeed(
        vehicle_name="Hyundai Creta",
        start_time=(base_time + timedelta(days=1)).replace(hour=6, minute=15, second=0, microsecond=0),
        duration_minutes=41,
        route=[
            (28.61274, 77.27732),
            (28.60861, 77.28492),
            (28.60376, 77.29308),
            (28.59892, 77.30118),
            (28.59387, 77.30964),
            (28.58841, 77.31824),
            (28.58291, 77.32544),
            (28.57594, 77.32563),
            (28.56724, 77.32637),
        ],
        idle_time_seconds=180,
        fuel_used_liters=1.3,
        cost_amount=138.0,
        avg_speed_mps=8.1,
        max_speed_mps=20.6,
        driving_score=88,
        events=[
            EventSeed("rapid_acceleration", 8, 1.06, {"acceleration_mps2": 3.19, "threshold_mps2": 3.0}),
            EventSeed("overspeed", 24, 1.03, {"speed_mps": 28.7, "speed_kph": 103.3, "threshold_mps": 27.78}),
        ],
    ),
    TripSeed(
        vehicle_name="Hyundai Creta",
        start_time=(base_time + timedelta(days=2)).replace(hour=13, minute=5, second=0, microsecond=0),
        duration_minutes=29,
        route=[
            (28.56724, 77.32637),
            (28.57594, 77.32563),
            (28.58291, 77.32544),
            (28.58841, 77.31824),
            (28.59387, 77.30964),
            (28.60376, 77.29308),
            (28.61274, 77.27732),
        ],
        idle_time_seconds=95,
        fuel_used_liters=0.9,
        cost_amount=97.0,
        avg_speed_mps=9.4,
        max_speed_mps=18.8,
        driving_score=91,
        events=[],
    ),
    TripSeed(
        vehicle_name="Tata Nexon EV",
        start_time=(base_time + timedelta(days=3)).replace(hour=9, minute=25, second=0, microsecond=0),
        duration_minutes=38,
        route=[
            (28.70406, 77.10249),
            (28.70018, 77.11042),
            (28.69486, 77.11911),
            (28.68971, 77.12855),
            (28.68442, 77.13784),
            (28.67908, 77.14776),
            (28.67344, 77.15858),
            (28.66728, 77.17019),
        ],
        idle_time_seconds=140,
        fuel_used_liters=0.0,
        cost_amount=0.0,
        avg_speed_mps=8.9,
        max_speed_mps=19.2,
        driving_score=94,
        events=[
            EventSeed("rapid_acceleration", 14, 1.01, {"acceleration_mps2": 3.04, "threshold_mps2": 3.0}),
        ],
    ),
    TripSeed(
        vehicle_name="Tata Nexon EV",
        start_time=(base_time + timedelta(days=4)).replace(hour=18, minute=15, second=0, microsecond=0),
        duration_minutes=32,
        route=[
            (28.66728, 77.17019),
            (28.66244, 77.17896),
            (28.65791, 77.18824),
            (28.65335, 77.19782),
            (28.64892, 77.20718),
            (28.64331, 77.21655),
            (28.63788, 77.22511),
            (28.63148, 77.21983),
        ],
        idle_time_seconds=70,
        fuel_used_liters=0.0,
        cost_amount=0.0,
        avg_speed_mps=9.7,
        max_speed_mps=20.4,
        driving_score=97,
        events=[],
    ),
    TripSeed(
        vehicle_name="Maruti Swift",
        start_time=(base_time + timedelta(days=4)).replace(hour=7, minute=35, second=0, microsecond=0),
        duration_minutes=27,
        route=[
            (28.45950, 77.02664),
            (28.46322, 77.03517),
            (28.46861, 77.04485),
            (28.47439, 77.05628),
            (28.48088, 77.06845),
            (28.48714, 77.08134),
            (28.49359, 77.09284),
        ],
        idle_time_seconds=210,
        fuel_used_liters=0.8,
        cost_amount=72.0,
        avg_speed_mps=7.8,
        max_speed_mps=17.6,
        driving_score=83,
        events=[
            EventSeed("harsh_brake", 9, 1.19, {"acceleration_mps2": -4.16, "threshold_mps2": -3.5}),
            EventSeed("harsh_brake", 19, 1.08, {"acceleration_mps2": -3.79, "threshold_mps2": -3.5}),
            EventSeed("rapid_acceleration", 22, 1.15, {"acceleration_mps2": 3.46, "threshold_mps2": 3.0}),
        ],
    ),
    TripSeed(
        vehicle_name="Maruti Swift",
        start_time=(base_time + timedelta(days=5)).replace(hour=16, minute=10, second=0, microsecond=0),
        duration_minutes=22,
        route=[
            (28.49359, 77.09284),
            (28.50016, 77.10473),
            (28.50694, 77.11622),
            (28.51382, 77.12705),
            (28.52074, 77.13811),
            (28.52708, 77.15039),
        ],
        idle_time_seconds=55,
        fuel_used_liters=0.6,
        cost_amount=54.0,
        avg_speed_mps=8.4,
        max_speed_mps=15.8,
        driving_score=90,
        events=[
            EventSeed("rapid_acceleration", 11, 1.02, {"acceleration_mps2": 3.07, "threshold_mps2": 3.0}),
        ],
    ),
    TripSeed(
        vehicle_name="Mahindra XUV700",
        start_time=(base_time + timedelta(days=5)).replace(hour=5, minute=50, second=0, microsecond=0),
        duration_minutes=58,
        route=[
            (28.61390, 77.20900),
            (28.60642, 77.22017),
            (28.59891, 77.23386),
            (28.58954, 77.24742),
            (28.57908, 77.25978),
            (28.56881, 77.27137),
            (28.55594, 77.28564),
            (28.54176, 77.30091),
            (28.52836, 77.31578),
            (28.51392, 77.33124),
        ],
        idle_time_seconds=260,
        fuel_used_liters=2.9,
        cost_amount=312.0,
        avg_speed_mps=11.3,
        max_speed_mps=29.9,
        driving_score=76,
        events=[
            EventSeed("overspeed", 16, 1.23, {"speed_mps": 34.2, "speed_kph": 123.1, "threshold_mps": 27.78}),
            EventSeed("overspeed", 31, 1.14, {"speed_mps": 31.6, "speed_kph": 113.8, "threshold_mps": 27.78}),
            EventSeed("harsh_brake", 44, 1.24, {"acceleration_mps2": -4.34, "threshold_mps2": -3.5}),
            EventSeed("rapid_acceleration", 48, 1.18, {"acceleration_mps2": 3.55, "threshold_mps2": 3.0}),
        ],
    ),
    TripSeed(
        vehicle_name="Mahindra XUV700",
        start_time=(base_time + timedelta(days=6)).replace(hour=14, minute=20, second=0, microsecond=0),
        duration_minutes=44,
        route=[
            (28.51392, 77.33124),
            (28.52748, 77.31602),
            (28.54118, 77.30144),
            (28.55512, 77.28651),
            (28.56802, 77.27218),
            (28.58149, 77.25706),
            (28.59555, 77.23989),
            (28.60764, 77.22255),
            (28.61390, 77.20900),
        ],
        idle_time_seconds=135,
        fuel_used_liters=2.1,
        cost_amount=226.0,
        avg_speed_mps=10.8,
        max_speed_mps=24.1,
        driving_score=86,
        events=[
            EventSeed("harsh_brake", 28, 1.06, {"acceleration_mps2": -3.7, "threshold_mps2": -3.5}),
        ],
    ),
]

for day_offset in range(7, 14):
    vehicle_name = ["Honda City", "Hyundai Creta", "Tata Nexon EV", "Maruti Swift", "Mahindra XUV700"][day_offset % 5]
    seed_route = {
        "Honda City": [
            (28.62892, 77.36486),
            (28.62638, 77.35214),
            (28.62374, 77.33922),
            (28.62170, 77.33150),
            (28.61848, 77.31682),
        ],
        "Hyundai Creta": [
            (28.61274, 77.27732),
            (28.60474, 77.29172),
            (28.59555, 77.30691),
            (28.58633, 77.32019),
            (28.57594, 77.32563),
        ],
        "Tata Nexon EV": [
            (28.70406, 77.10249),
            (28.69486, 77.11911),
            (28.68442, 77.13784),
            (28.67344, 77.15858),
            (28.66728, 77.17019),
        ],
        "Maruti Swift": [
            (28.45950, 77.02664),
            (28.46861, 77.04485),
            (28.48088, 77.06845),
            (28.49359, 77.09284),
        ],
        "Mahindra XUV700": [
            (28.61390, 77.20900),
            (28.59891, 77.23386),
            (28.57908, 77.25978),
            (28.55594, 77.28564),
            (28.52836, 77.31578),
        ],
    }[vehicle_name]
    score = 91 - (day_offset % 5) * 4
    events = []
    if day_offset % 2 == 0:
        events.append(EventSeed("harsh_brake", 12, 1.04, {"acceleration_mps2": -3.65, "threshold_mps2": -3.5}))
    if day_offset % 3 == 0:
        events.append(EventSeed("overspeed", 18, 1.07, {"speed_mps": 29.8, "speed_kph": 107.3, "threshold_mps": 27.78}))
    if day_offset % 4 == 0:
        events.append(EventSeed("rapid_acceleration", 8, 1.09, {"acceleration_mps2": 3.27, "threshold_mps2": 3.0}))

    TRIP_SEEDS.append(
        TripSeed(
            vehicle_name=vehicle_name,
            start_time=(base_time + timedelta(days=day_offset)).replace(hour=8 + (day_offset % 4) * 2, minute=10, second=0, microsecond=0),
            duration_minutes=24 + (day_offset % 5) * 6,
            route=seed_route,
            idle_time_seconds=60 + (day_offset % 4) * 45,
            fuel_used_liters=0.0 if vehicle_name == "Tata Nexon EV" else 0.8 + (day_offset % 5) * 0.35,
            cost_amount=0.0 if vehicle_name == "Tata Nexon EV" else 78.0 + (day_offset % 5) * 38,
            avg_speed_mps=7.6 + (day_offset % 5) * 0.9,
            max_speed_mps=17.8 + (day_offset % 5) * 2.4,
            driving_score=score,
            events=events,
        )
    )


async def _get_or_create_demo_user(session: AsyncSession) -> User:
    existing = await session.execute(select(User).where(User.email == DEMO_EMAIL))
    user = existing.scalar_one_or_none()
    if user is not None:
        return user

    user = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
    )
    session.add(user)
    await session.flush()
    return user


async def _get_or_create_vehicle(session: AsyncSession, *, user_id: uuid.UUID, seed: VehicleSeed) -> Vehicle:
    result = await session.execute(
        select(Vehicle).where(
            Vehicle.user_id == user_id,
            Vehicle.name == seed.name,
            Vehicle.deleted_at.is_(None),
        )
    )
    vehicle = result.scalar_one_or_none()
    if vehicle is None:
        vehicle = Vehicle(
            id=uuid.uuid4(),
            user_id=user_id,
            name=seed.name,
            plate_number=seed.plate_number,
            fuel_type=seed.fuel_type,
            tank_capacity_liters=seed.tank_capacity_liters,
            mileage_baseline_km_per_l=seed.mileage_baseline_km_per_l,
        )
        session.add(vehicle)
        await session.flush()
        return vehicle

    vehicle.plate_number = seed.plate_number
    vehicle.fuel_type = seed.fuel_type
    vehicle.tank_capacity_liters = seed.tank_capacity_liters
    vehicle.mileage_baseline_km_per_l = seed.mileage_baseline_km_per_l
    await session.flush()
    return vehicle


async def _trip_exists(session: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID, start_time: datetime) -> bool:
    result = await session.execute(
        select(Trip.id).where(
            Trip.user_id == user_id,
            Trip.vehicle_id == vehicle_id,
            Trip.start_time == start_time,
            Trip.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none() is not None


async def _create_trip_bundle(session: AsyncSession, *, user_id: uuid.UUID, vehicle: Vehicle, seed: TripSeed) -> None:
    if await _trip_exists(session, user_id=user_id, vehicle_id=vehicle.id, start_time=seed.start_time):
        return

    end_time = seed.start_time + timedelta(minutes=seed.duration_minutes)
    distance_meters = _route_distance_meters(seed.route)
    trip = Trip(
        id=uuid.uuid4(),
        user_id=user_id,
        vehicle_id=vehicle.id,
        state=TripState.ended,
        start_time=seed.start_time,
        end_time=end_time,
        distance_meters=distance_meters,
        duration_seconds=seed.duration_minutes * 60,
        avg_speed_mps=seed.avg_speed_mps,
        max_speed_mps=seed.max_speed_mps,
        idle_time_seconds=seed.idle_time_seconds,
        fuel_used_liters=seed.fuel_used_liters,
        cost_amount=seed.cost_amount,
        cost_currency="INR" if seed.cost_amount > 0 else None,
        driving_score=seed.driving_score,
    )
    session.add(trip)
    await session.flush()

    point_interval_seconds = max(30, int((seed.duration_minutes * 60) / max(len(seed.route) - 1, 1)))
    for index, (latitude, longitude) in enumerate(seed.route):
        recorded_at = seed.start_time + timedelta(seconds=index * point_interval_seconds)
        next_lat, next_lng = seed.route[min(index + 1, len(seed.route) - 1)]
        speed = seed.avg_speed_mps if index < len(seed.route) - 1 else max(seed.avg_speed_mps * 0.6, 1.2)
        heading = 0.0
        if index < len(seed.route) - 1:
            heading = ((next_lng - longitude) * 1000) % 360
        point = LocationPoint(
            trip_id=trip.id,
            recorded_at=recorded_at,
            latitude=latitude,
            longitude=longitude,
            speed_mps=speed,
            heading_deg=heading,
            accuracy_m=5.0 + (index % 3),
            altitude_m=210 + index,
            is_moving=index < len(seed.route) - 1,
            provider="seed_gps",
        )
        session.add(point)

    route_midpoint = seed.route[min(len(seed.route) // 2, len(seed.route) - 1)]
    for event_seed in seed.events:
        occurred_at = seed.start_time + timedelta(minutes=event_seed.minute_offset)
        event = Event(
            id=uuid.uuid4(),
            trip_id=trip.id,
            event_type=event_seed.event_type,
            intensity=event_seed.intensity,
            occurred_at=occurred_at,
            latitude=route_midpoint[0],
            longitude=route_midpoint[1],
            payload=event_seed.payload,
        )
        session.add(event)


async def seed_database() -> None:
    engine = create_async_engine(settings.sqlalchemy_database_uri_async, echo=False)
    await ensure_local_schema(engine)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        user = await _get_or_create_demo_user(session)

        vehicles_by_name: dict[str, Vehicle] = {}
        for vehicle_seed in VEHICLE_SEEDS:
            vehicle = await _get_or_create_vehicle(session, user_id=user.id, seed=vehicle_seed)
            vehicles_by_name[vehicle_seed.name] = vehicle

        for trip_seed in TRIP_SEEDS:
            vehicle = vehicles_by_name[trip_seed.vehicle_name]
            await _create_trip_bundle(session, user_id=user.id, vehicle=vehicle, seed=trip_seed)

        await session.commit()
        print("Demo database seeded/updated successfully.")
        print(f"Demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_database())
