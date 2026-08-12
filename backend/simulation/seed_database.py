"""Seed 30 days of physics-informed synthetic sensor data at 5-minute intervals.

Run from inside backend/: python -m simulation.seed_database
"""

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from tqdm import tqdm

from app.database import Base, SessionLocal, engine
from app.models import SensorReading, Zone
from simulation import occupancy, physics, weather

ZONE_CONFIGS = [
    {
        "name": "A-101", "floor": 1, "room_type": "office", "area": 28,
        "capacity": 12, "target_temperature": 22.0, "min_airflow": 150, "max_airflow": 900,
    },
    {
        "name": "A-102", "floor": 1, "room_type": "meeting-room", "area": 40,
        "capacity": 20, "target_temperature": 21.5, "min_airflow": 200, "max_airflow": 1200,
    },
    {
        "name": "A-104", "floor": 1, "room_type": "executive-office", "area": 18,
        "capacity": 4, "target_temperature": 21.0, "min_airflow": 100, "max_airflow": 500,
    },
    {
        "name": "B-201", "floor": 2, "room_type": "lab", "area": 55,
        "capacity": 15, "target_temperature": 20.5, "min_airflow": 300, "max_airflow": 1600,
    },
    {
        "name": "B-202", "floor": 2, "room_type": "classroom", "area": 70,
        "capacity": 30, "target_temperature": 22.0, "min_airflow": 300, "max_airflow": 1800,
    },
    {
        "name": "C-301", "floor": 3, "room_type": "server-room", "area": 20,
        "capacity": 2, "target_temperature": 18.0, "min_airflow": 400, "max_airflow": 1200,
    },
    {
        "name": "D-401", "floor": 4, "room_type": "lobby", "area": 90,
        "capacity": 50, "target_temperature": 23.0, "min_airflow": 250, "max_airflow": 2000,
    },
    {
        "name": "D-403", "floor": 4, "room_type": "office", "area": 24,
        "capacity": 10, "target_temperature": 22.0, "min_airflow": 150, "max_airflow": 800,
    },
]

DAYS_OF_HISTORY = 30
STEP_MINUTES = 5
BATCH_SIZE = 2000
SEED = 42


def seed() -> None:
    # occupancy.py seeds its own per-zone/time Random() instances deterministically,
    # but physics.py's noise terms use the global `random` module, so it must be
    # seeded here too for the whole run to be reproducible.
    random.seed(SEED)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Wiping existing zones/readings for a clean, reproducible seed...")
        db.execute(delete(SensorReading))
        db.execute(delete(Zone))
        db.commit()

        zones = []
        for config in ZONE_CONFIGS:
            zone = Zone(**config)
            db.add(zone)
            zones.append(zone)
        db.commit()
        for zone in zones:
            db.refresh(zone)

        state = {
            zone.id: {
                "temp": zone.target_temperature + random.uniform(-1, 1),
                "humidity": 45.0,
                "damper": 50.0,
            }
            for zone in zones
        }

        end = datetime.now(UTC).replace(tzinfo=None)
        start = end - timedelta(days=DAYS_OF_HISTORY)
        step = timedelta(minutes=STEP_MINUTES)
        total_ticks = int((end - start) / step)

        batch: list[SensorReading] = []
        total_rows = 0

        ts = start
        for _ in tqdm(range(total_ticks), desc="Seeding"):
            outdoor_temp = weather.get_outdoor_temperature(ts)

            for zone in zones:
                zone_state = state[zone.id]
                occ = occupancy.get_occupancy(zone.room_type, ts, zone.capacity, zone.name)

                damper = physics.compute_damper_response(
                    zone_state["temp"], zone.target_temperature, zone_state["damper"]
                )
                airflow = physics.compute_airflow(damper, zone.min_airflow, zone.max_airflow)
                new_temp, cooling_kw = physics.step_temperature(
                    zone_state["temp"],
                    outdoor_temp,
                    occ,
                    airflow,
                    damper,
                    zone.area,
                    zone.room_type,
                    dt_minutes=STEP_MINUTES,
                )
                new_humidity = physics.step_humidity(
                    zone_state["humidity"], occ, damper, dt_minutes=STEP_MINUTES
                )
                energy = physics.compute_energy_consumption(cooling_kw, airflow, dt_minutes=STEP_MINUTES)

                batch.append(
                    SensorReading(
                        zone_id=zone.id,
                        timestamp=ts,
                        temperature=round(new_temp, 2),
                        humidity=round(new_humidity, 2),
                        occupancy=occ,
                        airflow=round(airflow, 1),
                        damper_position=round(damper, 1),
                        energy_consumption=round(energy, 4),
                        outdoor_temperature=outdoor_temp,
                    )
                )

                zone_state["temp"] = new_temp
                zone_state["humidity"] = new_humidity
                zone_state["damper"] = damper

            if len(batch) >= BATCH_SIZE:
                db.bulk_save_objects(batch)
                db.commit()
                total_rows += len(batch)
                batch = []

            ts += step

        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            total_rows += len(batch)

        print(f"Seeded {len(zones)} zones and {total_rows} sensor readings from {start} to {end}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
