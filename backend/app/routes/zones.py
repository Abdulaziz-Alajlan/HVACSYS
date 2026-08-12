from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Zone
from app.schemas import ZoneOut

router = APIRouter(prefix="/api/zones", tags=["zones"])


@router.get("", response_model=list[ZoneOut])
def list_zones(db: Session = Depends(get_db)):
    return db.scalars(select(Zone).order_by(Zone.id)).all()


@router.get("/{zone_id}", response_model=ZoneOut)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone
