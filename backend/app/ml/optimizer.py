"""Airflow optimizer: scores candidate damper positions against a comfort+energy objective.

Uses the deterministic physics model (not the ML predictor) to project each
candidate forward, since we need a controllable "what happens if we set the
damper to X" simulation rather than a "what happens if nothing changes"
forecast — that's what predictor.py answers instead.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.features import HORIZON_MINUTES
from app.models import SensorReading, Zone
from simulation import physics

DAMPER_STEP = 5
DAMPER_CANDIDATES = list(range(0, 101, DAMPER_STEP))

# Cost weights for the objective:
#   cost = COMFORT_WEIGHT * max(0, |ΔT from setpoint| - COMFORT_DEADBAND_C)^2
#        + ENERGY_WEIGHT * energy over the horizon (kWh)
# Comfort is a deadband + quadratic penalty, not linear: small deviations near
# setpoint barely matter (lets energy use break ties there), but a real miss
# (a couple degrees off) must dominate any plausible energy savings — otherwise
# the optimizer "saves energy" by leaving an overheated room to cook, which is
# not a usable recommendation regardless of the kWh math.
COMFORT_DEADBAND_C = 0.3
COMFORT_WEIGHT = 8.0
ENERGY_WEIGHT = 1.0

ACTION_THRESHOLD = DAMPER_STEP  # min damper delta (%) to call it a real change
COMFORT_IMPACT_THRESHOLD = 0.1  # °C of deviation change to call comfort improved/degraded


def _project(current: SensorReading, zone: Zone, damper_position: float, airflow: float) -> dict:
    new_temp, cooling_kw = physics.step_temperature(
        current.temperature,
        current.outdoor_temperature,
        current.occupancy,
        airflow,
        damper_position,
        zone.area,
        zone.room_type,
        dt_minutes=HORIZON_MINUTES,
        add_noise=False,
    )
    energy = physics.compute_energy_consumption(cooling_kw, airflow, dt_minutes=HORIZON_MINUTES)
    return {"damper": damper_position, "airflow": airflow, "temp": new_temp, "energy": energy}


def optimize(db: Session, zone: Zone) -> dict | None:
    """Recommend a damper position for `zone`, or None if it has no readings yet."""
    current = db.scalars(
        select(SensorReading).where(SensorReading.zone_id == zone.id).order_by(SensorReading.timestamp.desc()).limit(1)
    ).first()
    if current is None:
        return None

    baseline = _project(current, zone, current.damper_position, current.airflow)

    best = None
    for damper in DAMPER_CANDIDATES:
        airflow = physics.compute_airflow(damper, zone.min_airflow, zone.max_airflow, add_noise=False)
        projection = _project(current, zone, damper, airflow)
        deviation = abs(projection["temp"] - zone.target_temperature)
        comfort_penalty = max(0.0, deviation - COMFORT_DEADBAND_C) ** 2
        cost = COMFORT_WEIGHT * comfort_penalty + ENERGY_WEIGHT * projection["energy"]
        if best is None or cost < best["cost"]:
            best = {**projection, "cost": cost}

    damper_delta = best["damper"] - current.damper_position
    if damper_delta > ACTION_THRESHOLD:
        action = "increase_airflow"
    elif damper_delta < -ACTION_THRESHOLD:
        action = "decrease_airflow"
    else:
        action = "maintain"

    baseline_deviation = abs(baseline["temp"] - zone.target_temperature)
    new_deviation = abs(best["temp"] - zone.target_temperature)
    if new_deviation < baseline_deviation - COMFORT_IMPACT_THRESHOLD:
        comfort_impact = "improves"
    elif new_deviation > baseline_deviation + COMFORT_IMPACT_THRESHOLD:
        comfort_impact = "degrades"
    else:
        comfort_impact = "neutral"

    energy_change = best["energy"] - baseline["energy"]

    # Even the best candidate can't reach the deadband — the zone's heat gain
    # currently exceeds its max cooling capacity, not a search failure. Flag
    # it explicitly rather than let the reason read like a generic/stuck
    # response when every scenario severe enough to trigger this converges on
    # the same "100%" ceiling regardless of how far over capacity it is.
    capacity_constrained = best["damper"] >= max(DAMPER_CANDIDATES) - 1e-9 and new_deviation > COMFORT_DEADBAND_C

    if capacity_constrained:
        reason = (
            f"Zone demand currently exceeds cooling capacity even at 100% damper — "
            f"projected to reach {best['temp']:.1f}°C vs target {zone.target_temperature:.1f}°C "
            f"over the next {HORIZON_MINUTES} min despite maximum airflow."
        )
    else:
        reason = (
            f"Setting damper to {best['damper']:.0f}% (from {current.damper_position:.0f}%) is projected to "
            f"reach {best['temp']:.1f}°C vs {baseline['temp']:.1f}°C if unchanged "
            f"(target {zone.target_temperature:.1f}°C) over the next {HORIZON_MINUTES} min, "
            f"{'using' if energy_change >= 0 else 'saving'} {abs(energy_change):.3f} kWh."
        )

    return {
        "timestamp": current.timestamp,
        "action": action,
        "current_airflow": current.airflow,
        "recommended_airflow": round(best["airflow"], 1),
        "reason": reason,
        "estimated_energy_change": round(energy_change, 4),
        "comfort_impact": comfort_impact,
        "status": "pending",
    }
