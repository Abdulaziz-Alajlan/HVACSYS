import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.ml import predictor
from app.routes import predictions, readings, zones


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "airwise-api", "time": datetime.now(UTC).isoformat()}
