# Mobile v2 — Garage

Date: 2026-10-16. Scope chosen: full Rovy Garage minus photo upload; make and model typed as free text.

## Screen (`src/app/(tabs)/garage.tsx`)

Top to bottom, matching the Rovy screenshots:

1. **Header**: rolling "My / Garage" via `StickyHeaderScroll`, settings glass button on the right (opens `/settings`).
2. **Vehicle strip**: horizontal row of 72 pt rounded-square tiles (tint background, vehicle-type icon in accent).
   The active vehicle has an accent border and a small badge; tapping a tile makes it active
   (`vehicleStore.setActive`). A dashed accent "+" tile opens the Add sheet.
3. **Hero card**: dashed-border card; large tinted circle with the vehicle icon, display name (extrabold),
   grey pills for HP, year and fuel (only the ones that are set).
4. **Top speed**: full-width orange card, big black-weight number, "km/h", flame icon and "Top speed" label.
5. **Stat tiles**: row of two (Drives, Ø km/h), row of three (km, Time, Streak); value large, label under it,
   small tertiary icon top-right.
6. **Edit** full-width filled accent button, opens the Edit sheet.

Empty state (no vehicles): hero area becomes an "Add your first vehicle" card that opens the Add sheet.

## Add / Edit sheet (`src/components/garage/VehicleSheet.tsx`)

iOS page-sheet `Modal`. Header: glass "Cancel", title "Add Car" / "Add Motorbike" / "Edit", glass "Add" / "Save"
(accent text, disabled until make and model are filled). Sections with secondary labels:

- **Vehicle type**: two big buttons, Car / Motorbike; selected is filled accent.
- **Name (optional)**, **Make**, **Model**: pill text inputs on card background.
- **Details**: one card with Year and HP rows (number inputs aligned right, hairline between).
- **Fuel**: segmented control Petrol / Diesel / Electric / Hybrid / CNG.
- Edit only: "Delete vehicle" destructive text button (confirm alert).

## Backend

- Migration `20261016_0006`: `vehicles.vehicle_type` (`car` | `motorbike`, default `car`), `vehicles.year`
  (int, nullable, 1900–2100), `vehicles.horsepower` (int, nullable, > 0).
- `VehicleCreate`: `model_id` **or** `make` + `model` (free text); the service finds or creates the catalog
  company and model case-insensitively. `VehicleUpdate` accepts the same, plus the new fields.
- `VehicleRead` gains `vehicle_type`, `year`, `horsepower`.
- `GET /vehicles/{id}/home-stats?tz=` (the old `/stats` stays for mobile-expo) returns the Home `HomeStats` shape restricted to that vehicle
  (`get_home_stats(..., vehicle_id=)`); 404 if not owned.

## Mobile data

- `vehicleService`: `create`, `update`, `remove`, `stats(id)`.
- `vehicleStore`: `create`, `update`, `remove` (refresh list; new vehicle becomes active),
  `stats: Record<id, HomeStats>` with `loadStats(id)`.

## Testing

- Backend unit tests for find-or-create make/model and the create/update payload validation.
- Jest tests for the store actions and service calls.
- Simulator check of the Garage tab and both sheet states.

## Revision 2026-10-17

- Hero card: SVG dashed outline (`DashedOutline`), "Add photo" / "Change photo" button (camera or library,
  cropped 4:3, resized to 1200 px JPEG, base64). Tags always show HP, year and fuel, with a dash when unknown.
- Backend: migration `20261017_0007` adds `vehicles.photo` (bytea, deferred) and `photo_updated_at`;
  `GET/PUT/DELETE /vehicles/{id}/photo`; `VehicleRead.photo_url` is a versioned path.
- Make and model are picked, not typed: `PickerField` opens matching options as you type (catalog in
  `src/data/vehicleCatalog.ts`, split by car and motorbike). An edited vehicle's own make/model stays valid.
