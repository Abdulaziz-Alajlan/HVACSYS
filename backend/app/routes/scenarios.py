from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.live_tick import run_tick
from app.models import SensorReading, Zone
from app.schemas import ScenarioRequest, SensorReadingOut

router = APIRouter(prefix="/api", tags=["scenarios"])

HOT_OUTDOOR_DELTA_C = 6.0  # added to the zone's current outdoor reading, not an absolute value
OCCUPANCY_SURGE_FRACTION = 0.8  # of capacity, not 1.0 — see note below
# occupancy_surge/hot_outdoor_period used to force capacity/+12°C, which — on
# top of an already-warm outdoor baseline — routinely exceeded a zone's max
# cooling capacity, so the optimizer correctly maxed out the damper for any
# sufficiently severe overload: different scenarios all converged on the same
# "100%" ceiling instead of visibly differentiating. Dialed back so most
# zones stay within recoverable range (see optimizer.py for the remaining,
# legitimately-overloaded case's messaging).
BLOCKED_DAMPER_TICKS = 6  # * TICK_MINUTES = 30 simulated minutes


@router.post("/zones/{zone_id}/scenario", response_model=SensorReadingOut, status_code=201)
def inject_scenario(zone_id: int, payload: ScenarioRequest, db: Session = Depends(get_db)):
    """Stress-tests a zone: occupancy surge (~OCCUPANCY_SURGE_FRACTION of
    capacity), a hot outdoor spell (+HOT_OUTDOOR_DELTA_C over current), or a
    stuck damper (frozen at its current position for BLOCKED_DAMPER_TICKS
    ticks, ignoring what the controller would pick, so temperature actually
    drifts before the optimizer is asked to react to it)."""
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    latest = db.scalars(
        select(SensorReading)
        .where(SensorReading.zone_id == zone_id)
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    ).first()
    if latest is None:
        raise HTTPException(status_code=400, detail="This zone has no sensor readings yet")

    if payload.scenario == "occupancy_surge":
        surge_occupancy = max(1, round(zone.capacity * OCCUPANCY_SURGE_FRACTION))
        new_reading = run_tick(db, zone, occupancy_override=surge_occupancy)
    elif payload.scenario == "hot_outdoor_period":
        new_reading = run_tick(db, zone, outdoor_temp_override=latest.outdoor_temperature + HOT_OUTDOOR_DELTA_C)
    else:  # blocked_damper
        frozen_damper = latest.damper_position
        new_reading = None
        for _ in range(BLOCKED_DAMPER_TICKS):
            new_reading = run_tick(db, zone, damper_override=frozen_damper)
            if new_reading is None:
                break

    if new_reading is None:
        raise HTTPException(status_code=400, detail="Zone has no sensor history to inject a scenario against")
    return new_reading
