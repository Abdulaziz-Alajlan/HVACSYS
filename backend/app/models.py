from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    room_type: Mapped[str] = mapped_column(String, nullable=False)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    target_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    min_airflow: Mapped[float] = mapped_column(Float, nullable=False)
    max_airflow: Mapped[float] = mapped_column(Float, nullable=False)

    readings: Mapped[list["SensorReading"]] = relationship(
        "SensorReading", back_populates="zone", cascade="all, delete-orphan"
    )


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (Index("ix_sensor_readings_zone_ts", "zone_id", "timestamp"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    humidity: Mapped[float] = mapped_column(Float, nullable=False)
    occupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    airflow: Mapped[float] = mapped_column(Float, nullable=False)
    damper_position: Mapped[float] = mapped_column(Float, nullable=False)
    # kWh consumed during this 5-minute interval (not instantaneous kW)
    energy_consumption: Mapped[float] = mapped_column(Float, nullable=False)
    outdoor_temperature: Mapped[float] = mapped_column(Float, nullable=False)

    zone: Mapped["Zone"] = relationship("Zone", back_populates="readings")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    horizon_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_cooling_demand: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String, nullable=False)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    current_airflow: Mapped[float] = mapped_column(Float, nullable=False)
    recommended_airflow: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_energy_change: Mapped[float] = mapped_column(Float, nullable=False)
    comfort_impact: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
