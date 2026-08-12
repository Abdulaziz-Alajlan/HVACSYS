"""Loads the trained model bundle and predicts 30-min-ahead temperature/energy for a zone."""

import warnings
from datetime import timedelta
from functools import lru_cache

import joblib
import pandas as pd
import sklearn
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.features import FEATURE_COLUMNS, HORIZON_MINUTES, TREND_LOOKBACK_STEPS, build_live_features
from app.models import SensorReading, Zone

ARTIFACT_PATH = "app/ml/artifacts/model.joblib"

# Static, validation-derived confidence: how MAE (°C) maps to a 0-1 confidence
# score. Not a per-request uncertainty estimate — that would need quantile
# regression or an ensemble spread, out of scope for Day 2.
CONFIDENCE_SCALE_C = 2.0
CONFIDENCE_MIN = 0.5
CONFIDENCE_MAX = 0.99


@lru_cache(maxsize=1)
def _load_bundle() -> dict:
    bundle = joblib.load(ARTIFACT_PATH)
    trained_version = bundle.get("sklearn_version")
    if trained_version and trained_version != sklearn.__version__:
        warnings.warn(
            f"Model bundle was trained with scikit-learn {trained_version}, "
            f"but {sklearn.__version__} is installed. Predictions may be unreliable "
            "— see scikit-learn's model persistence docs.",
            stacklevel=2,
        )
    return bundle


def warm_up() -> None:
    """Load (and validate) the model bundle eagerly, so a missing/corrupt
    artifact fails at app startup instead of on the first prediction request."""
    _load_bundle()


def _confidence(mae: float) -> float:
    return max(CONFIDENCE_MIN, min(CONFIDENCE_MAX, 1 - mae / CONFIDENCE_SCALE_C))


def predict(db: Session, zone: Zone) -> dict | None:
    """Predict temperature/energy 30 minutes ahead for `zone`.

    Returns None if there isn't enough sensor history yet (needs at least
    TREND_LOOKBACK_STEPS+1 readings to compute the temperature trend feature).
    """
    recent = db.scalars(
        select(SensorReading)
        .where(SensorReading.zone_id == zone.id)
        .order_by(SensorReading.timestamp.desc())
        .limit(TREND_LOOKBACK_STEPS + 1)
    ).all()
    if len(recent) < TREND_LOOKBACK_STEPS + 1:
        return None

    current = recent[0]
    trend_reading = recent[-1]

    current_row = {
        "timestamp": current.timestamp,
        "humidity": current.humidity,
        "occupancy": current.occupancy,
        "airflow": current.airflow,
        "damper_position": current.damper_position,
        "energy_consumption": current.energy_consumption,
        "outdoor_temperature": current.outdoor_temperature,
    }
    features = build_live_features(zone, current.temperature, current_row, trend_reading.temperature)
    X = pd.DataFrame([features])[FEATURE_COLUMNS]

    bundle = _load_bundle()
    predicted_temperature = float(bundle["temperature_model"].predict(X)[0])
    predicted_energy = float(bundle["energy_model"].predict(X)[0])

    return {
        "timestamp": current.timestamp + timedelta(minutes=HORIZON_MINUTES),
        "horizon_minutes": HORIZON_MINUTES,
        "predicted_temperature": round(predicted_temperature, 2),
        "predicted_cooling_demand": round(predicted_energy, 4),
        "confidence": round(_confidence(bundle["metrics"]["temperature"]["mae"]), 3),
        "model_version": f"{bundle['model_type']}-{bundle['version']}",
    }
