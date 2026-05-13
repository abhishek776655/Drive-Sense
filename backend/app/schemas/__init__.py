from app.schemas.base import SchemaBase
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.dashboard import (
    DashboardResponse,
    EventBreakdown,
    MetricSummary,
    RecentTripSummary,
    TrendPoint,
    VehicleDashboardSummary,
    VehicleStatsResponse,
    VehicleStatsSummary,
)
from app.schemas.event import EventCreate, EventRead
from app.schemas.fuel_log import FuelLogCreate, FuelLogRead
from app.schemas.location_point import LocationIngestResponse, LocationPointCreate, LocationPointRead
from app.schemas.trip import TripEndRequest, TripRead, TripStartRequest
from app.schemas.user import UserCreate, UserRead
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate

__all__ = [
    "SchemaBase",
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "DashboardResponse",
    "EventBreakdown",
    "EventCreate",
    "EventRead",
    "FuelLogCreate",
    "FuelLogRead",
    "LocationIngestResponse",
    "LocationPointCreate",
    "LocationPointRead",
    "MetricSummary",
    "RecentTripSummary",
    "TrendPoint",
    "TripStartRequest",
    "TripEndRequest",
    "TripRead",
    "UserCreate",
    "UserRead",
    "VehicleDashboardSummary",
    "VehicleStatsResponse",
    "VehicleStatsSummary",
    "VehicleCreate",
    "VehicleRead",
    "VehicleUpdate",
]
