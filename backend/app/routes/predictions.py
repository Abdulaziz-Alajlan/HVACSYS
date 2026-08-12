from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml import predictor
from app.models import Prediction, Zone
from app.schemas import PredictionOut

router = APIRouter(prefix="/api", tags=["predictions"])


@router.post("/predict/{zone_id}", response_model=PredictionOut, status_code=201)
def predict_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    result = predictor.predict(db, zone)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Not enough sensor history for this zone yet (need at least 15 minutes of readings)",
        )

    prediction = Prediction(zone_id=zone.id, **result)
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


@router.get("/zones/{zone_id}/predictions", response_model=list[PredictionOut])
def list_zone_predictions(
    zone_id: int,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    stmt = (
        select(Prediction)
        .where(Prediction.zone_id == zone_id)
        .order_by(Prediction.timestamp.desc())
        .limit(limit)
    )
    predictions = db.scalars(stmt).all()
    return list(reversed(predictions))
