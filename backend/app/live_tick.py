"""Advances a zone one real (noisy) physics tick from its latest reading, with
optional input overrides.

This is the shared primitive behind two Day 4 features that both boil down
to "run one tick, but force one input": applying a recommendation (forces
the damper position instead of letting the P-controller choose it) and
scenario injection (forces occupancy, outdoor temperature, or a stuck
damper). Reuses simulation.physics/occupancy/weather rather than
reimplementing tick logic a third time (seed_database.py and
live_simulator.py are the other two, both process-local; this one persists
directly since the API process has no long-lived per-zone state to update).
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SensorReading, Zone
from simulation import occupancy, physics, weather

TICK_MINUTES = 5.0


def run_tick(
    db: Session,
    zone: Zone,
    *,
    damper_override: float | None = None,
    occupancy_override: int | None = None,
    outdoor_temp_override: float | None = None,
) -> SensorReading | None:
    """Returns the new reading, or None if `zone` has no prior readings to advance from."""
    current = db.scalars(
        select(SensorReading)
        .where(SensorReading.zone_id == zone.id)
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    ).first()
    if current is None:
        return None

    ts = datetime.now(UTC).replace(tzinfo=None)
    outdoor_temp = (
        outdoor_temp_override if outdoor_temp_override is not None else weather.get_outdoor_temperature(ts)
    )
    occ = (
        occupancy_override
        if occupancy_override is not None
        else occupancy.get_occupancy(zone.room_type, ts, zone.capacity, zone.name)
    )
    damper = (
        damper_override
        if damper_override is not None
        else physics.compute_damper_response(current.temperature, zone.target_temperature, current.damper_position)
    )

    airflow = physics.compute_airflow(damper, zone.min_airflow, zone.max_airflow)
    new_temp, cooling_kw = physics.step_temperature(
        current.temperature, outdoor_temp, occ, airflow, damper, zone.area, zone.room_type, dt_minutes=TICK_MINUTES
    )
    new_humidity = physics.step_humidity(current.humidity, occ, damper, dt_minutes=TICK_MINUTES)
    energy = physics.compute_energy_consumption(cooling_kw, airflow, dt_minutes=TICK_MINUTES)

    reading = SensorReading(
        zone_id=zone.id,
        timestamp=ts,
        temperature=round(new_temp, 2),
        humidity=round(new_humidity, 2),
        occupancy=occ,
        airflow=round(airflow, 1),
        damper_position=round(damper, 1),
        energy_consumption=round(energy, 4),
        outdoor_temperature=round(outdoor_temp, 2),
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading
