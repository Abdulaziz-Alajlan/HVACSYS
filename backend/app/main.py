import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.ml import predictor
from app.models import Zone
from app.routes import predictions, readings, recommendations, scenarios, zones
from simulation import seed_database


def _seed_if_empty() -> None:
    """Seeds 30 days of history on first boot against an empty database (e.g.
    a fresh Railway volume), but never touches an already-seeded/live one —
    the whole point of a persistent disk is that restarts don't lose data."""
    db = SessionLocal()
    try:
        zone_exists = db.scalars(select(Zone.id).limit(1)).first() is not None
        if not zone_exists:
            print("No zones found — seeding initial data...")
            seed_database.seed()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_if_empty()
    predictor.warm_up()
    yield


app = FastAPI(title="AirWise HVAC API", version="0.1.0", lifespan=lifespan)

cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(zones.router)
app.include_router(readings.router)
app.include_router(predictions.router)
app.include_router(recommendations.router)
app.include_router(scenarios.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "airwise-api", "time": datetime.now(UTC).isoformat()}
