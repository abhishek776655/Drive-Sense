# DriveSense docs

# DriveSense – Full Product Requirements & Technical Design Document

## Version: v2.0

## Date: 2026-05-01

---

# 1. Overview

DriveSense is a vehicle intelligence platform that captures trip, location, and behavioral data to generate actionable insights on driving efficiency, safety, and cost.

---

# 2. Problem Statement

Drivers lack:

- Visibility into driving behavior
- Accurate cost & fuel analytics
- Actionable improvement insights

---

# 3. Product Vision

A system that transforms raw driving data into:

- Intelligence
- Optimization
- Behavioral feedback

---

# 4. Core Modules

## 4.1 Vehicle Management

- Multi-vehicle support
- Active vehicle selection
- Vehicle-specific analytics

---

## 4.2 Trip Engine

- Auto trip detection
- Background tracking
- Trip lifecycle management

---

## 4.3 Location Tracking

- Continuous GPS capture
- Polyline route generation
- Event overlays

---

## 4.4 Analytics Engine

- Metrics computation
- Driving score
- Trend analysis

---

## 4.5 Dashboard

- Per-vehicle stats
- Global insights

---

# 5. System Architecture

Mobile App → API Layer → Processing Layer → Database → Analytics Layer

---

# 6. Tech Stack

## Mobile

- React Native (TypeScript)
- NativeWind
- react-native-maps
- background-geolocation SDK

## Backend

- FastAPI (Python)

## Database

- PostgreSQL
- TimescaleDB (time-series)

## Cache

- Redis

## Infra

- AWS (EC2, RDS, ElastiCache)

---

# 7. Full Database Schema

## users

- id (PK)
- email
- password_hash
- created_at

---

## vehicles

- id (PK)
- user_id (FK)
- name
- fuel_type
- tank_capacity
- mileage_baseline
- created_at

---

## trips

- id (PK)
- user_id (FK)
- vehicle_id (FK)
- start_time
- end_time
- distance
- duration
- avg_speed
- max_speed
- idle_time
- fuel_used
- cost
- driving_score
- created_at

---

## location_points

- id (PK)
- trip_id (FK)
- latitude
- longitude
- speed
- heading
- timestamp

---

## events

- id (PK)
- trip_id (FK)
- type (brake, accel, overspeed)
- intensity
- timestamp

---

## fuel_logs

- id (PK)
- vehicle_id (FK)
- liters
- cost
- odometer
- timestamp

---

## vehicle_stats (aggregated)

- vehicle_id (PK)
- total_distance
- total_fuel
- avg_mileage
- total_cost
- avg_score

---

# 8. API Design

## Vehicles

POST /vehicles  
GET /vehicles  
PUT /vehicles/{id}  
DELETE /vehicles/{id}

---

## Trips

POST /trips/start  
POST /trips/end  
GET /trips  
GET /trips/{id}

---

## Location

POST /trips/{id}/locations  
GET /trips/{id}/route

---

## Events

POST /events

---

## Dashboard

GET /dashboard  
GET /vehicles/{id}/stats

---

# 9. Trip Lifecycle

States:

- IDLE
- STARTED
- ACTIVE
- PAUSED
- ENDED

---

# 10. Trip Detection Logic

Start:

- Speed > 10 km/h for 10 sec

End:

- No movement for 3–5 min

---

# 11. Location Strategy

- Sampling:
  - 3–5 sec OR 30m distance
- Batch upload
- Polyline encoding

---

# 12. Driving Score Model

Score = 100

- (harsh_brake_count × weight1)
- (acceleration_count × weight2)
- (overspeed_duration × weight3)

Normalize: 0–100

---

# 13. Processing Pipeline

1. Receive trip data
2. Store raw data
3. Compute metrics
4. Update aggregates
5. Generate insights

---

# 14. Performance Strategy

- Batch ingestion
- Async processing
- Caching dashboards
- Index time-series data

---

# 15. Security

- JWT authentication
- HTTPS only
- Data encryption at rest

---

# 16. Privacy

- User data deletion
- Trip privacy mode
- Location masking

---

# 17. Future Enhancements

- AI driving coach
- EV analytics
- Fleet dashboard
- Insurance integration

---

# 18. Final Positioning

DriveSense = Vehicle Intelligence System
