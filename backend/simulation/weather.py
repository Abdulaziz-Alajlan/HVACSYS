"""Synthetic outdoor temperature model.

Seasonal cosine + a per-day persistent offset (weather fronts) + a diurnal
cosine + small noise. Feeds directly into physics.step_temperature's
envelope-conduction term, so outdoor temp -> cooling demand is a direct,
traceable causal path.
"""

import math
import random
from datetime import date, datetime


def _seasonal_base_temp(day: date, mean: float = 27.0, amplitude: float = 3.0) -> float:
    day_of_year = day.timetuple().tm_yday
    return mean + amplitude * math.cos(2 * math.pi * (day_of_year - 200) / 365)


def _daily_offset(day: date, sigma: float = 2.0) -> float:
    rng = random.Random(f"weather-{day.isoformat()}")
    return rng.gauss(0, sigma)


def _diurnal_component(timestamp: datetime, amplitude: float = 6.0, peak_hour: float = 15.0) -> float:
    hour = timestamp.hour + timestamp.minute / 60.0
    return amplitude * math.cos(2 * math.pi * (hour - peak_hour) / 24)


def get_outdoor_temperature(timestamp: datetime) -> float:
    day = timestamp.date()
    value = (
        _seasonal_base_temp(day)
        + _daily_offset(day)
        + _diurnal_component(timestamp)
        + random.gauss(0, 0.3)
    )
    return round(value, 2)
