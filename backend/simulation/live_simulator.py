"""Standalone live HVAC simulator: advances zone state one physics tick at a time.

CLI usage (from inside backend/):
    python -m simulation.live_simulator --ticks 5 --interval 1
    python -m simulation.live_simulator                # runs forever, 5-min ticks
"""

import argparse
import time
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import SensorReading, Zone
from simulation import occupancy, physics, weather


class LiveSimulator:
    def __init__(self, db: Session):
        self.db = db
        self.zones = db.query(Zone).order_by(Zone.id).all()
        self.state: dict[int, dict[str, float]] = {}

        for zone in self.zones:
            last_reading = (
                db.query(SensorReading)
                .filter(SensorReading.zone_id == zone.id)
                .order_by(SensorReading.timestamp.desc())
                .first()
            )
            if last_reading is not None:
                self.state[zone.id] = {
                    "temp": last_reading.temperature,
                    "humidity": last_reading.humidity,
                    "damper": last_reading.damper_position,
                }
            else:
                self.state[zone.id] = {
                    "temp": zone.target_temperature,
                    "humidity": 45.0,
                    "damper": 50.0,
                }

    def tick(self, timestamp: datetime | None = None, dt_minutes: float = 5.0) -> list[SensorReading]:
        ts = timestamp or datetime.now(UTC).replace(tzinfo=None)
        outdoor_temp = weather.get_outdoor_temperature(ts)
        new_readings = []

        for zone in self.zones:
            zone_state = self.state[zone.id]
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
                dt_minutes=dt_minutes,
            )
            new_humidity = physics.step_humidity(zone_state["humidity"], occ, damper, dt_minutes=dt_minutes)
            energy = physics.compute_energy_consumption(cooling_kw, airflow, dt_minutes=dt_minutes)

            reading = SensorReading(
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
            self.db.add(reading)
            new_readings.append(reading)

            zone_state["temp"] = new_temp
            zone_state["humidity"] = new_humidity
            zone_state["damper"] = damper

        self.db.commit()
        for reading in new_readings:
            self.db.refresh(reading)
        return new_readings

    def run_forever(self, interval_seconds: float = 300, dt_minutes: float = 5.0) -> None:
        while True:
            readings = self.tick(dt_minutes=dt_minutes)
            print(f"[{datetime.now(UTC).isoformat()}] wrote {len(readings)} readings")
            time.sleep(interval_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AirWise live HVAC simulator")
    parser.add_argument("--ticks", type=int, default=None, help="Number of ticks to run (default: forever)")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds to sleep between ticks")
    parser.add_argument("--dt-minutes", type=float, default=5.0, help="Simulated minutes advanced per tick")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        sim = LiveSimulator(db)
        if args.ticks is None:
            sim.run_forever(interval_seconds=args.interval, dt_minutes=args.dt_minutes)
        else:
            for i in range(args.ticks):
                readings = sim.tick(dt_minutes=args.dt_minutes)
                summary = ", ".join(f"zone {r.zone_id}: {r.temperature}°C" for r in readings)
                print(f"tick {i + 1}/{args.ticks} — {summary}")
                if i < args.ticks - 1:
                    time.sleep(args.interval)
    finally:
        db.close()


if __name__ == "__main__":
    main()
