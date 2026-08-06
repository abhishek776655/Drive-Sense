"""add vehicle company/model catalog and link vehicles to it

Revision ID: 20260801_0002
Revises: 20260513_0001
Create Date: 2026-08-01 00:00:00
"""
from __future__ import annotations

from alembic import op


revision = "20260801_0002"
down_revision = "20260513_0001"
branch_labels = None
depends_on = None


# (company, model, image_url) — image_url is a Wikimedia Commons Special:FilePath
# thumbnail link (width=600) so mobile clients don't pull multi-MB originals.
CATALOG = [
    ("Maruti Suzuki", "Swift", "Maruti_Suzuki_Swift_4456.JPG"),
    ("Maruti Suzuki", "Baleno", "2016_Suzuki_Baleno_SZ5_Boosterjet_1.0_Front.jpg"),
    ("Hyundai", "Creta", "Hyundai_Creta.jpg"),
    ("Hyundai", "i20", "Hyundai_i20_(BC3)_IMG_4165.jpg"),
    ("Tata", "Nexon", "2018_Tata_Nexon_XM.jpg"),
    ("Tata", "Punch", "Tata_punch.ev.jpg"),
    ("Mahindra", "XUV700", "A_black_Mahindra_XUV700_SUV_in_Ashiana_Brahmananda,_Jamshedpur,_India_(Ank_Kumar,_Infosys_Limited)_02.jpg"),
    ("Mahindra", "Scorpio-N", "2024_Mahindra_Scorpio_Z8L_front.jpg"),
    ("Kia", "Seltos", "White_KIA_Seltos_(Side).jpg"),
    ("Kia", "Sonet", "2022_Kia_Sonet.jpg"),
    ("Honda", "City", "2022_Honda_City_ZX_i-VTEC_(India)_front_view_(cropped).jpg"),
    ("Honda", "Amaze", "Honda_Amaze_front_view.jpg"),
    ("Toyota", "Innova Crysta", "Toyota_Innova_Crysta.jpg"),
    ("Toyota", "Fortuner", "Toyota_Fortuner_(AN160)_Front.jpg"),
    ("Skoda", "Slavia", "Skoda_Slavia_Side_view.jpg"),
    ("Skoda", "Kushaq", "Skoda_Kushaq_Front.jpg"),
    ("Volkswagen", "Virtus", "2023_Volkswagen_Virtus_Topline_front_20230520.jpg"),
    ("Volkswagen", "Taigun", "2020_Volkswagen_Taigun_Side_View.jpg"),
    ("MG", "Hector", "MG(Morris_Garages)_Hector_SUV_in_Jamshedpur,_Jharkhand,_India_(Ank_Kumar,_Infosys_Limited))_01.jpg"),
    ("MG", "Astor", "2021_MG_Astor_Sharp_220_Turbo_(India)_front_view.png"),
    ("Other", "Other", None),
]

COMMONS_BASE = "https://commons.wikimedia.org/wiki/Special:FilePath"


def _image_url(filename: str | None) -> str | None:
    if filename is None:
        return None
    from urllib.parse import quote

    return f"{COMMONS_BASE}/{quote(filename, safe='')}?width=600"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicle_companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicle_models (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES vehicle_companies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            image_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (company_id, name)
        )
        """
    )

    companies = list(dict.fromkeys(company for company, _model, _image in CATALOG))
    for company in companies:
        op.execute(f"INSERT INTO vehicle_companies (name) VALUES ('{company}') ON CONFLICT (name) DO NOTHING")

    for company, model, image_filename in CATALOG:
        image_url = _image_url(image_filename)
        image_sql = "NULL" if image_url is None else f"'{image_url}'"
        op.execute(
            f"""
            INSERT INTO vehicle_models (company_id, name, image_url)
            SELECT id, '{model}', {image_sql} FROM vehicle_companies WHERE name = '{company}'
            ON CONFLICT (company_id, name) DO NOTHING
            """
        )

    op.execute("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES vehicle_models(id)")

    # Best-effort backfill: match existing free-text vehicle name against "Company Model".
    op.execute(
        """
        UPDATE vehicles v
        SET model_id = vm.id
        FROM vehicle_models vm
        JOIN vehicle_companies vc ON vm.company_id = vc.id
        WHERE v.model_id IS NULL
          AND v.name IS NOT NULL
          AND v.name ILIKE (vc.name || ' ' || vm.name)
        """
    )

    # Anything left unmatched falls back to the generic Other/Other entry;
    # the original free-text name is preserved as the vehicle's nickname.
    op.execute(
        """
        UPDATE vehicles
        SET model_id = (
            SELECT vm.id FROM vehicle_models vm
            JOIN vehicle_companies vc ON vm.company_id = vc.id
            WHERE vc.name = 'Other' AND vm.name = 'Other'
        )
        WHERE model_id IS NULL
        """
    )

    op.execute("ALTER TABLE vehicles ALTER COLUMN model_id SET NOT NULL")
    op.execute("ALTER TABLE vehicles ALTER COLUMN name DROP NOT NULL")
    op.execute("ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_name_nonempty")
    op.execute(
        """
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_name_nonempty
        CHECK (name IS NULL OR length(trim(name)) > 0)
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS vehicles_model_id_idx ON vehicles (model_id)")


def downgrade() -> None:
    op.execute("ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_name_nonempty")
    op.execute(
        """
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_name_nonempty
        CHECK (length(trim(name)) > 0)
        """
    )
    op.execute("UPDATE vehicles SET name = COALESCE(name, 'Unknown Vehicle') WHERE name IS NULL")
    op.execute("ALTER TABLE vehicles ALTER COLUMN name SET NOT NULL")
    op.execute("DROP INDEX IF EXISTS vehicles_model_id_idx")
    op.execute("ALTER TABLE vehicles DROP COLUMN IF EXISTS model_id")
    op.execute("DROP TABLE IF EXISTS vehicle_models")
    op.execute("DROP TABLE IF EXISTS vehicle_companies")
