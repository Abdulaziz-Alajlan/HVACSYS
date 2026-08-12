from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.live_tick import run_tick
from app.ml import optimizer
from app.models import Recommendation, Zone
from app.schemas import RecommendationApplyOut, RecommendationOut
from simulation import physics

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.post("/recommendations/{zone_id}", response_model=RecommendationOut, status_code=201)
def create_recommendation(zone_id: int, db: Session = Depends(get_db)):
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    result = optimizer.optimize(db, zone)
    if result is None:
        raise HTTPException(status_code=400, detail="This zone has no sensor readings yet")

    recommendation = Recommendation(zone_id=zone.id, **result)
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    return recommendation


@router.get("/zones/{zone_id}/recommendations", response_model=list[RecommendationOut])
def list_zone_recommendations(
    zone_id: int,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    stmt = (
        select(Recommendation)
        .where(Recommendation.zone_id == zone_id)
        .order_by(Recommendation.timestamp.desc())
        .limit(limit)
    )
    recommendations = db.scalars(stmt).all()
    return list(reversed(recommendations))


@router.post("/recommendations/{recommendation_id}/apply", response_model=RecommendationApplyOut)
def apply_recommendation(recommendation_id: int, db: Session = Depends(get_db)):
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if recommendation.status != "pending":
        raise HTTPException(status_code=400, detail=f"Recommendation is already '{recommendation.status}'")

    zone = db.get(Zone, recommendation.zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")

    # Force the damper to the recommended position for this tick, rather than
    # letting the normal P-controller pick it — this is what makes "apply"
    # actually mutate simulator state instead of just flipping a status flag.
    damper = physics.damper_from_airflow(recommendation.recommended_airflow, zone.min_airflow, zone.max_airflow)
    new_reading = run_tick(db, zone, damper_override=damper)
    if new_reading is None:
        raise HTTPException(status_code=400, detail="Zone has no sensor history to apply against")

    recommendation.status = "applied"
    db.commit()
    db.refresh(recommendation)
    return RecommendationApplyOut(recommendation=recommendation, new_reading=new_reading)
