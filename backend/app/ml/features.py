"""Feature engineering shared by training (train.py) and live serving (predictor.py).

Both paths must compute the same features the same way, so the per-row math
(cyclical time encoding, room-type one-hot) lives in small helper functions
used by both the vectorized (pandas) training path and the scalar serving path.
"""

import math
from datetime import datetime

import numpy as np
import pandas as pd
from sqlalchemy.engine import Engine

from app.models import Zone

STEP_MINUTES = 5
HORIZON_MINUTES = 30
HORIZON_STEPS = HORIZON_MINUTES // STEP_MINUTES  # 6
TREND_LOOKBACK_STEPS = 15 // STEP_MINUTES  # 3 steps = 15 min

# Fixed order so one-hot columns are identical between training and a
# single-row live prediction, regardless of which room types are present.
ROOM_TYPES = [
    "office",
    "meeting-room",
    "executive-office",
    "lab",
    "classroom",
    "server-room",
    "lobby",
]

BASE_FEATURES = [
    "temperature",
    "humidity",
    "occupancy",
    "airflow",
    "damper_position",
    "energy_consumption",
    "outdoor_temperature",
    "temp_change_15min",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "area",
    "capacity",
    "target_temperature",
    "min_airflow",
    "max_airflow",
]
ROOM_TYPE_FEATURES = [f"room_type_{rt}" for rt in ROOM_TYPES]
FEATURE_COLUMNS = BASE_FEATURES + ROOM_TYPE_FEATURES


def _cyclical_hour(timestamp: datetime) -> tuple[float, float]:
    hour_frac = timestamp.hour + timestamp.minute / 60.0
    angle = 2 * math.pi * hour_frac / 24
    return math.sin(angle), math.cos(angle)


def _room_type_onehot(room_type: str) -> dict[str, int]:
    return {f"room_type_{rt}": int(rt == room_type) for rt in ROOM_TYPES}


def load_training_frame(engine: Engine) -> pd.DataFrame:
    """Sensor readings joined with their zone's static attributes, one row per reading."""
    query = """
        SELECT
            sr.zone_id, sr.timestamp, sr.temperature, sr.humidity, sr.occupancy,
            sr.airflow, sr.damper_position, sr.energy_consumption, sr.outdoor_temperature,
            z.room_type, z.area, z.capacity, z.target_temperature, z.min_airflow, z.max_airflow
        FROM sensor_readings sr
        JOIN zones z ON z.id = sr.zone_id
        ORDER BY sr.zone_id, sr.timestamp
    """
    return pd.read_sql(query, engine, parse_dates=["timestamp"])


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add engineered features and the two 30-min-ahead prediction targets.

    Drops rows that can't have a trend feature (first 15 min of each zone's
    history) or a target (last 30 min of each zone's history).
    """
    df = df.sort_values(["zone_id", "timestamp"]).reset_index(drop=True)
    by_zone = df.groupby("zone_id")

    df["temp_change_15min"] = df["temperature"] - by_zone["temperature"].shift(TREND_LOOKBACK_STEPS)

    hour_frac = df["timestamp"].dt.hour + df["timestamp"].dt.minute / 60.0
    angle = 2 * np.pi * hour_frac / 24
    df["hour_sin"] = np.sin(angle)
    df["hour_cos"] = np.cos(angle)
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    df["future_temperature"] = by_zone["temperature"].shift(-HORIZON_STEPS)
    df["future_energy_consumption"] = by_zone["energy_consumption"].shift(-HORIZON_STEPS)

    room_type_cat = pd.Categorical(df["room_type"], categories=ROOM_TYPES)
    dummies = pd.get_dummies(room_type_cat, prefix="room_type").astype(int)
    df = pd.concat([df, dummies], axis=1)

    df = df.dropna(
        subset=["temp_change_15min", "future_temperature", "future_energy_consumption"]
    ).reset_index(drop=True)
    return df


def build_live_features(zone: Zone, current_temp: float, current_row: dict, trend_row_temp: float) -> dict:
    """Build one feature row for live prediction from the latest reading and one 15-min-old reading.

    `current_row` holds the latest SensorReading's field values (as a plain dict);
    `trend_row_temp` is the temperature from the reading ~15 minutes prior.
    """
    hour_sin, hour_cos = _cyclical_hour(current_row["timestamp"])
    day_of_week = current_row["timestamp"].weekday()

    features = {
        "temperature": current_temp,
        "humidity": current_row["humidity"],
        "occupancy": current_row["occupancy"],
        "airflow": current_row["airflow"],
        "damper_position": current_row["damper_position"],
        "energy_consumption": current_row["energy_consumption"],
        "outdoor_temperature": current_row["outdoor_temperature"],
        "temp_change_15min": current_temp - trend_row_temp,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "day_of_week": day_of_week,
        "is_weekend": int(day_of_week >= 5),
        "area": zone.area,
        "capacity": zone.capacity,
        "target_temperature": zone.target_temperature,
        "min_airflow": zone.min_airflow,
        "max_airflow": zone.max_airflow,
    }
    features.update(_room_type_onehot(zone.room_type))
    return features
