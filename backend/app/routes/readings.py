from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SensorReading, Zone
from app.schemas import SensorReadingCreate, SensorReadingOut

router = APIRouter(prefix="/api", tags=["readings"])


@router.post("/readings", response_model=SensorReadingOut, status_code=201)
def create_reading(payload: SensorReadingCreate, db: Session = Depends(get_db)):
    zone = db.get(Zone, payload.zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    timestamp = payload.timestamp or datetime.now(UTC)
    if timestamp.tzinfo is not None:
        timestamp = timestamp.astimezone(UTC).replace(tzinfo=None)

    reading = SensorReading(
        **payload.model_dump(exclude={"timestamp"}),
        timestamp=timestamp,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/zones/{zone_id}/readings", response_model=list[SensorReadingOut])
def list_zone_readings(
    zone_id: int,
    limit: int = Query(default=100, le=1000),
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
):
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    stmt = select(SensorReading).where(SensorReading.zone_id == zone_id)
    if start is not None:
        stmt = stmt.where(SensorReading.timestamp >= start)
    if end is not None:
        stmt = stmt.where(SensorReading.timestamp <= end)
    stmt = stmt.order_by(SensorReading.timestamp.desc()).limit(limit)

    readings = db.scalars(stmt).all()
    return list(reversed(readings))
