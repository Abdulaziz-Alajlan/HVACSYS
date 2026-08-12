from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ZoneBase(BaseModel):
    name: str
    floor: int
    room_type: str
    area: float
    capacity: int
    target_temperature: float
    min_airflow: float
    max_airflow: float


class ZoneOut(ZoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class SensorReadingBase(BaseModel):
    temperature: float
    humidity: float
    occupancy: int
    airflow: float
    damper_position: float
    energy_consumption: float
    outdoor_temperature: float


class SensorReadingCreate(SensorReadingBase):
    zone_id: int
    timestamp: datetime | None = None


class SensorReadingOut(SensorReadingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: int
    timestamp: datetime


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: int
    timestamp: datetime
    horizon_minutes: int
    predicted_temperature: float
    predicted_cooling_demand: float
    confidence: float
    model_version: str


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: int
    timestamp: datetime
    action: str
    current_airflow: float
    recommended_airflow: float
    reason: str
    estimated_energy_change: float
    comfort_impact: str | None
    status: str


class RecommendationApplyOut(BaseModel):
    recommendation: RecommendationOut
    new_reading: SensorReadingOut


class ScenarioRequest(BaseModel):
    scenario: Literal["occupancy_surge", "hot_outdoor_period", "blocked_damper"]
