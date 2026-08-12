"""Room-type-dependent occupancy schedules.

Each handler returns an occupancy *fraction* in [0, 1]; get_occupancy() turns
that into a headcount. Randomness is seeded deterministically per zone/time
so re-running the seed script reproduces the same dataset.
"""

import random
from datetime import date, datetime

_meeting_blocks_cache: dict[tuple[str, date], list[tuple[float, float, float]]] = {}
_classroom_period_cache: dict[tuple[str, date, int], float] = {}


def _clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _is_weekday(timestamp: datetime) -> bool:
    return timestamp.weekday() < 5


def _hour_frac(timestamp: datetime) -> float:
    return timestamp.hour + timestamp.minute / 60.0


def _office_fraction(timestamp: datetime, zone_key: str, base: float = 0.75) -> float:
    if not _is_weekday(timestamp):
        rng = random.Random(f"{zone_key}-weekend-{timestamp.date()}")
        if rng.random() < 0.03:
            hour = _hour_frac(timestamp)
            return 0.1 if 8 <= hour < 18 else 0.0
        return 0.0

    hour = _hour_frac(timestamp)
    if hour < 7 or hour >= 19:
        return 0.0
    if 7 <= hour < 8 or 17 <= hour < 19:
        fraction = 0.4
    elif 12 <= hour < 13:
        fraction = 0.25
    elif 8 <= hour < 12 or 13 <= hour < 17:
        fraction = base
    else:
        fraction = 0.3

    rng = random.Random(f"{zone_key}-{timestamp.isoformat()}")
    return _clip(fraction + rng.gauss(0, 0.15), 0.0, 1.0)


def _meeting_room_fraction(timestamp: datetime, zone_key: str) -> float:
    if not _is_weekday(timestamp):
        return 0.0

    day = timestamp.date()
    cache_key = (zone_key, day)
    if cache_key not in _meeting_blocks_cache:
        rng = random.Random(f"{zone_key}-meetings-{day}")
        n_blocks = rng.randint(2, 4)
        blocks = []
        for _ in range(n_blocks):
            start_hour = rng.uniform(8, 17)
            duration = rng.choice([0.5, 1.0, 1.5])
            fraction = rng.uniform(0.5, 1.0)
            blocks.append((start_hour, start_hour + duration, fraction))
        _meeting_blocks_cache[cache_key] = blocks

    hour = _hour_frac(timestamp)
    for start, end, fraction in _meeting_blocks_cache[cache_key]:
        if start <= hour < end:
            return fraction
    return 0.0


def _executive_office_fraction(timestamp: datetime, zone_key: str) -> float:
    if not _is_weekday(timestamp):
        rng = random.Random(f"{zone_key}-weekend-{timestamp.date()}")
        if rng.random() < 0.03:
            hour = _hour_frac(timestamp)
            return 0.1 if 8 <= hour < 18 else 0.0
        return 0.0

    hour = _hour_frac(timestamp)
    if hour < 7.5 or hour >= 18:
        return 0.0

    rng = random.Random(f"{zone_key}-{timestamp.isoformat()}")
    return _clip(0.6 + rng.gauss(0, 0.25), 0.0, 1.0)


def _lab_fraction(timestamp: datetime, zone_key: str) -> float:
    if not _is_weekday(timestamp):
        rng = random.Random(f"{zone_key}-weekend-{timestamp.date()}")
        if rng.random() < 0.10:
            return 0.2
        return 0.0

    hour = _hour_frac(timestamp)
    if hour < 9 or hour >= 21:
        return 0.0

    rng = random.Random(f"{zone_key}-{timestamp.isoformat()}")
    return _clip(0.5 + rng.gauss(0, 0.2), 0.0, 1.0)


def _classroom_fraction(timestamp: datetime, zone_key: str) -> float:
    if not _is_weekday(timestamp):
        return 0.0

    hour = _hour_frac(timestamp)
    if hour < 8 or hour >= 17:
        return 0.0
    if timestamp.minute >= 50:
        return 0.0

    cache_key = (zone_key, timestamp.date(), timestamp.hour)
    if cache_key not in _classroom_period_cache:
        rng = random.Random(f"{zone_key}-classroom-{timestamp.date()}-{timestamp.hour}")
        _classroom_period_cache[cache_key] = rng.uniform(0.7, 1.0)
    return _classroom_period_cache[cache_key]


def _server_room_fraction(timestamp: datetime, zone_key: str, capacity: int) -> float:
    rng = random.Random(f"{zone_key}-{timestamp.isoformat()}")
    weekday_hours = _is_weekday(timestamp) and 7 <= _hour_frac(timestamp) < 19
    chance = 0.03 if weekday_hours else 0.01
    if rng.random() < chance:
        return 1.0 / max(capacity, 1)
    return 0.0


def _lobby_fraction(timestamp: datetime, zone_key: str) -> float:
    hour = _hour_frac(timestamp)
    rng = random.Random(f"{zone_key}-{timestamp.isoformat()}")

    if not _is_weekday(timestamp):
        return _clip(0.1 + rng.gauss(0, 0.05), 0.0, 1.0)

    if hour < 7 or hour >= 19:
        return _clip(0.05 + rng.gauss(0, 0.03), 0.0, 1.0)
    if 8 <= hour < 9 or 17 <= hour < 18:
        return _clip(rng.uniform(0.6, 0.8), 0.0, 1.0)
    return _clip(0.3 + rng.gauss(0, 0.1), 0.0, 1.0)


_HANDLERS = {
    "office": _office_fraction,
    "meeting-room": _meeting_room_fraction,
    "executive-office": _executive_office_fraction,
    "lab": _lab_fraction,
    "classroom": _classroom_fraction,
    "lobby": _lobby_fraction,
}


def get_occupancy(room_type: str, timestamp: datetime, capacity: int, zone_key: str) -> int:
    if room_type == "server-room":
        fraction = _server_room_fraction(timestamp, zone_key, capacity)
    else:
        handler = _HANDLERS.get(room_type, _office_fraction)
        fraction = handler(timestamp, zone_key)

    rng = random.Random(f"{zone_key}-count-{timestamp.isoformat()}")
    count = round(fraction * capacity + rng.gauss(0, 0.5))
    return int(_clip(count, 0, capacity))
