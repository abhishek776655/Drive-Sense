from __future__ import annotations

import httpx
import pytest

from app.core.config import Settings
from app.services.geocoding_service import (
    MAX_ADDRESS_LENGTH,
    extract_first_feature_properties,
    format_photon_address,
    reverse_geocode,
)


def _settings() -> Settings:
    return Settings(PHOTON_BASE_URL="https://photon.example", PHOTON_TIMEOUT_SECONDS=1.0, PHOTON_LANGUAGE="en")


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


class TestFormatPhotonAddress:
    def test_pairs_the_place_with_its_city(self):
        assert format_photon_address({"name": "Indiranagar", "city": "Bengaluru"}) == "Indiranagar, Bengaluru"

    def test_falls_back_through_place_keys(self):
        assert format_photon_address({"district": "Koramangala", "city": "Bengaluru"}) == "Koramangala, Bengaluru"

    def test_prefers_name_over_street(self):
        properties = {"name": "Cubbon Park", "street": "Kasturba Road", "city": "Bengaluru"}

        assert format_photon_address(properties) == "Cubbon Park, Bengaluru"

    def test_attaches_a_house_number_to_its_street(self):
        properties = {"street": "MG Road", "housenumber": "42", "city": "Bengaluru"}

        assert format_photon_address(properties) == "42 MG Road, Bengaluru"

    def test_ignores_a_house_number_with_no_street(self):
        assert format_photon_address({"name": "Indiranagar", "housenumber": "42"}) == "Indiranagar"

    def test_falls_back_through_area_keys(self):
        assert format_photon_address({"name": "Somewhere", "state": "Karnataka"}) == "Somewhere, Karnataka"

    def test_does_not_repeat_an_identical_place_and_area(self):
        assert format_photon_address({"name": "Bengaluru", "city": "Bengaluru"}) == "Bengaluru"

    def test_deduplicates_case_insensitively(self):
        assert format_photon_address({"name": "bengaluru", "city": "Bengaluru"}) == "bengaluru"

    def test_uses_country_when_nothing_local_resolves(self):
        assert format_photon_address({"country": "India"}) == "India"

    def test_returns_none_for_an_unnameable_point(self):
        assert format_photon_address({"osm_id": 1234}) is None

    def test_returns_none_for_empty_properties(self):
        assert format_photon_address({}) is None
        assert format_photon_address(None) is None

    def test_trims_to_the_column_width(self):
        result = format_photon_address({"name": "x" * 400, "city": "y" * 400})

        assert result is not None
        assert len(result) == MAX_ADDRESS_LENGTH

    def test_ignores_blank_values(self):
        assert format_photon_address({"name": "   ", "city": "Bengaluru"}) == "Bengaluru"


class TestExtractFirstFeatureProperties:
    def test_reads_the_closest_match(self):
        payload = {"features": [{"properties": {"name": "A"}}, {"properties": {"name": "B"}}]}

        assert extract_first_feature_properties(payload) == {"name": "A"}

    def test_handles_an_empty_feature_list(self):
        assert extract_first_feature_properties({"features": []}) is None

    def test_handles_a_malformed_payload(self):
        assert extract_first_feature_properties({"features": "nope"}) is None
        assert extract_first_feature_properties({"features": ["nope"]}) is None
        assert extract_first_feature_properties({}) is None
        assert extract_first_feature_properties(None) is None


class TestReverseGeocode:
    async def test_returns_a_formatted_address(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200, json={"features": [{"properties": {"name": "Indiranagar", "city": "Bengaluru"}}]}
            )

        async with _client(handler) as client:
            result = await reverse_geocode(client, latitude=12.97, longitude=77.59, settings=_settings())

        assert result == "Indiranagar, Bengaluru"

    async def test_sends_the_coordinate_and_language(self):
        captured: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured.update(dict(request.url.params))
            captured["path"] = request.url.path
            captured["user_agent"] = request.headers["User-Agent"]
            return httpx.Response(200, json={"features": []})

        async with _client(handler) as client:
            await reverse_geocode(client, latitude=12.97, longitude=77.59, settings=_settings())

        assert captured["path"] == "/reverse"
        assert captured["lat"] == "12.97"
        assert captured["lon"] == "77.59"
        assert captured["lang"] == "en"
        assert "DriveSense" in captured["user_agent"]

    async def test_returns_none_on_a_server_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text="unavailable")

        async with _client(handler) as client:
            result = await reverse_geocode(client, latitude=12.97, longitude=77.59, settings=_settings())

        assert result is None

    async def test_returns_none_when_the_network_fails(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("no route to host")

        async with _client(handler) as client:
            result = await reverse_geocode(client, latitude=12.97, longitude=77.59, settings=_settings())

        assert result is None

    async def test_returns_none_when_the_body_is_not_json(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="<html>nope</html>")

        async with _client(handler) as client:
            result = await reverse_geocode(client, latitude=12.97, longitude=77.59, settings=_settings())

        assert result is None

    async def test_survives_a_trailing_slash_on_the_base_url(self):
        captured: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["path"] = request.url.path
            return httpx.Response(200, json={"features": []})

        settings = Settings(PHOTON_BASE_URL="https://photon.example/", PHOTON_LANGUAGE="en")
        async with _client(handler) as client:
            await reverse_geocode(client, latitude=1.0, longitude=2.0, settings=settings)

        assert captured["path"] == "/reverse"
