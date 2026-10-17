import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services.vehicle_service import find_or_create_model


def _result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


async def test_reuses_an_existing_make_and_model():
    company = SimpleNamespace(id=uuid.uuid4())
    model = SimpleNamespace(id=uuid.uuid4())
    db = _db(_result(company), _result(model))
    assert await find_or_create_model(db, make="skoda", model="citigo") == model.id
    db.add.assert_not_called()


async def test_creates_a_new_make_and_model_with_tidy_names():
    db = _db(_result(None), _result(None))

    async def flush():
        for call in db.add.call_args_list:
            row = call.args[0]
            row.id = row.id or uuid.uuid4()

    db.flush = AsyncMock(side_effect=flush)
    model_id = await find_or_create_model(db, make="  Royal   Enfield ", model="Classic 350")
    added = [call.args[0] for call in db.add.call_args_list]
    assert isinstance(added[0], VehicleCompany) and added[0].name == "Royal Enfield"
    assert isinstance(added[1], VehicleModel) and added[1].name == "Classic 350"
    assert added[1].company_id == added[0].id
    assert model_id == added[1].id


def test_create_needs_a_catalog_model_or_a_typed_make_and_model():
    assert VehicleCreate(make="Skoda", model="Citigo").vehicle_type == "car"
    assert VehicleCreate(model_id=uuid.uuid4()).model_id is not None
    with pytest.raises(ValidationError):
        VehicleCreate(make="Skoda")
    with pytest.raises(ValidationError):
        VehicleCreate(make="Skoda", model="Citigo", vehicle_type="truck")
    with pytest.raises(ValidationError):
        VehicleCreate(make="Skoda", model="Citigo", year=1800)


def test_update_takes_make_and_model_together():
    assert VehicleUpdate(year=2024).year == 2024
    assert VehicleUpdate(make="Skoda", model="Fabia").model == "Fabia"
    with pytest.raises(ValidationError):
        VehicleUpdate(make="Skoda")


def test_photo_must_be_a_small_jpeg_or_png():
    import base64

    from app.services.vehicle_service import MAX_PHOTO_BYTES, decode_photo

    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 10
    assert decode_photo(base64.b64encode(jpeg).decode()) == (jpeg, "image/jpeg")
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 10
    assert decode_photo(base64.b64encode(png).decode())[1] == "image/png"
    with pytest.raises(ValueError, match="JPEG or PNG"):
        decode_photo(base64.b64encode(b"GIF89a").decode())
    with pytest.raises(ValueError, match="base64"):
        decode_photo("not base64!")
    with pytest.raises(ValueError, match="too large"):
        decode_photo(base64.b64encode(b"\xff\xd8\xff" + b"0" * MAX_PHOTO_BYTES).decode())
