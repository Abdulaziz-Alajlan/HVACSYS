from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.live_tick import run_tick
from app.models import SensorReading, Zone
from app.schemas import ScenarioRequest, SensorReadingOut

router = APIRouter(prefix="/api", tags=["scenarios"])

HOT_OUTDOOR_DELTA_C = 12.0  # added to the zone's current outdoor reading, not an absolute value


@router.post("/zones/{zone_id}/scenario", response_model=SensorReadingOut, status_code=201)
def inject_scenario(zone_id: int, payload: ScenarioRequest, db: Session = Depends(get_db)):
    """Stress-tests a zone by forcing one input for a single tick, then lets
    normal physics react: occupancy surge (full capacity), a hot outdoor
    spell (+HOT_OUTDOOR_DELTA_C over current), or a stuck damper (frozen at
    its current position, ignoring what the controller would pick)."""
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
        new_reading = run_tick(db, zone, occupancy_override=zone.capacity)
    elif payload.scenario == "hot_outdoor_period":
        new_reading = run_tick(db, zone, outdoor_temp_override=latest.outdoor_temperature + HOT_OUTDOOR_DELTA_C)
    else:  # blocked_damper
        new_reading = run_tick(db, zone, damper_override=latest.damper_position)

    if new_reading is None:
        raise HTTPException(status_code=400, detail="Zone has no sensor history to inject a scenario against")
    return new_reading
