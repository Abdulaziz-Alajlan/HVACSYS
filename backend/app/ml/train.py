"""Train the 30-min-ahead temperature/energy predictor and save the best model.

Run from inside backend/: python -m app.ml.train
"""

from datetime import UTC, datetime

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.database import engine
from app.ml.features import FEATURE_COLUMNS, HORIZON_MINUTES, engineer_features, load_training_frame

SEED = 42
TEST_FRACTION = 0.2  # last 20% of days, by wall-clock time, held out
ARTIFACT_PATH = "app/ml/artifacts/model.joblib"

CANDIDATES = {
    "LinearRegression": lambda: LinearRegression(),
    "RandomForestRegressor": lambda: RandomForestRegressor(
        n_estimators=100, max_depth=10, min_samples_leaf=5, random_state=SEED, n_jobs=-1
    ),
    "GradientBoostingRegressor": lambda: GradientBoostingRegressor(random_state=SEED),
}


def _evaluate(model, X_test, y_test) -> dict[str, float]:
    y_pred = model.predict(X_test)
    return {
        "mae": mean_absolute_error(y_test, y_pred),
        "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
        "r2": r2_score(y_test, y_pred),
    }


def train() -> None:
    print("Loading sensor_readings joined with zones...")
    raw = load_training_frame(engine)
    df = engineer_features(raw)
    print(f"{len(df)} feature rows after engineering (dropped edge rows with no trend/target)")

    # Gap of HORIZON_MINUTES between train and test: without it, a training row
    # just before the cutoff has a future_* target that falls inside the test
    # window, leaking test-period values into training (sklearn's TimeSeriesSplit
    # `gap` param exists for exactly this reason).
    cutoff = df["timestamp"].quantile(1 - TEST_FRACTION)
    train_mask = df["timestamp"] <= cutoff - pd.Timedelta(minutes=HORIZON_MINUTES)
    test_mask = df["timestamp"] > cutoff
    print(f"Time-based split at {cutoff} (gap={HORIZON_MINUTES}min): {train_mask.sum()} train rows, {test_mask.sum()} test rows")

    X = df[FEATURE_COLUMNS]
    X_train, X_test = X[train_mask], X[test_mask]
    y_temp_train, y_temp_test = df["future_temperature"][train_mask], df["future_temperature"][test_mask]
    y_energy_train, y_energy_test = (
        df["future_energy_consumption"][train_mask],
        df["future_energy_consumption"][test_mask],
    )

    print("\nTemperature target (°C, 30-min-ahead) — model comparison:")
    temp_results = {}
    for name, make_model in CANDIDATES.items():
        model = make_model()
        model.fit(X_train, y_temp_train)
        metrics = _evaluate(model, X_test, y_temp_test)
        temp_results[name] = {"model": model, **metrics}
        print(f"  {name:<26} MAE={metrics['mae']:.4f}  RMSE={metrics['rmse']:.4f}  R2={metrics['r2']:.4f}")

    best_name = min(temp_results, key=lambda n: temp_results[n]["mae"])
    best_temp_model = temp_results[best_name]["model"]
    best_temp_metrics = {k: v for k, v in temp_results[best_name].items() if k != "model"}
    print(f"\nBest model: {best_name} (lowest MAE)")

    print(f"\nEnergy target (kWh, 30-min-ahead) — refitting {best_name}:")
    energy_model = CANDIDATES[best_name]()
    energy_model.fit(X_train, y_energy_train)
    energy_metrics = _evaluate(energy_model, X_test, y_energy_test)
    print(f"  {best_name:<26} MAE={energy_metrics['mae']:.4f}  RMSE={energy_metrics['rmse']:.4f}  R2={energy_metrics['r2']:.4f}")

    bundle = {
        "model_type": best_name,
        "temperature_model": best_temp_model,
        "energy_model": energy_model,
        "feature_columns": FEATURE_COLUMNS,
        "trained_at": datetime.now(UTC).isoformat(),
        "metrics": {"temperature": best_temp_metrics, "energy": energy_metrics},
        "version": "v1",
        # scikit-learn's own persistence docs warn that loading a pickle/joblib
        # artifact under a different sklearn version than it was trained with
        # is unsupported; record it so a version mismatch is diagnosable.
        "sklearn_version": sklearn.__version__,
    }
    joblib.dump(bundle, ARTIFACT_PATH, compress=3)
    print(f"\nSaved {best_name} bundle to {ARTIFACT_PATH}")


if __name__ == "__main__":
    train()
