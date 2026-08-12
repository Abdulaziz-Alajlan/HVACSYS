"""Lumped-thermal-capacitance HVAC physics model.

Every state transition is new_state = f(old_state, inputs, dt) + noise so that
occupancy/outdoor-temp/airflow relationships are causal by construction rather
than independently randomized per field.
"""

import random

Q_PERSON_KW = 0.12  # sensible heat gain per occupant (ASHRAE light-office figure)
EQUIPMENT_HEAT_LOAD_KW = {"server-room": 3.0}  # constant IT heat load by room type
UA_PER_M2 = 0.03  # envelope conductance, kW/°C per m²
THERMAL_MASS_PER_M2 = 200.0  # thermal capacitance, kJ/°C per m²
SUPPLY_AIR_TEMP_C = 13.0  # AHU cold supply air temperature
AIR_DENSITY = 1.2  # kg/m³
AIR_CP = 1.005  # kJ/(kg·K)
CFM_TO_M3S = 0.000471947
COP = 3.0  # cooling system coefficient of performance
FAN_POWER_COEFF = 0.00006  # kW per CFM, linear fan-power approximation
TEMP_NOISE_SIGMA = 0.05  # °C

DAMPER_KP = 18.0  # % damper opening per °C of temperature error
DAMPER_MAX_SLEW = 15.0  # max % the damper can move per 5-min tick

HUMIDITY_TARGET_BASE = 40.0
HUMIDITY_ALPHA = 0.15  # per-5-min convergence rate toward target
HUMIDITY_NOISE_SIGMA = 0.4


def _clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def compute_damper_response(
    current_temp: float,
    target_temp: float,
    prev_damper: float,
    min_damper: float = 10.0,
    max_damper: float = 100.0,
) -> float:
    """Proportional thermostat controller, slew-rate limited for actuator gradualness."""
    error = current_temp - target_temp
    desired = _clip(50 + DAMPER_KP * error, min_damper, max_damper)
    delta = _clip(desired - prev_damper, -DAMPER_MAX_SLEW, DAMPER_MAX_SLEW)
    return prev_damper + delta


def compute_airflow(
    damper_position: float, min_airflow: float, max_airflow: float, add_noise: bool = True
) -> float:
    base = min_airflow + (max_airflow - min_airflow) * damper_position / 100.0
    if not add_noise:
        return _clip(base, min_airflow, max_airflow)
    noisy = base + random.gauss(0, (max_airflow - min_airflow) * 0.02)
    return _clip(noisy, min_airflow, max_airflow)


def step_temperature(
    current_temp: float,
    outdoor_temp: float,
    occupancy: int,
    airflow_cfm: float,
    damper_position: float,
    area_m2: float,
    room_type: str,
    dt_minutes: float = 5.0,
    add_noise: bool = True,
) -> tuple[float, float]:
    """Advance zone temperature by one physics step.

    Thermal time constant for these zone sizes works out to roughly 60-90
    minutes, well above the 5-minute step, so plain Euler integration stays
    numerically stable and non-oscillatory without substeps.

    `add_noise=False` gives a deterministic projection, used by the optimizer
    to score candidate damper positions against each other on equal footing.
    """
    c_thermal = area_m2 * THERMAL_MASS_PER_M2  # kJ/°C
    ua = area_m2 * UA_PER_M2  # kW/°C
    airflow_m3s = airflow_cfm * CFM_TO_M3S

    cooling_kw = (
        airflow_m3s
        * AIR_DENSITY
        * AIR_CP
        * max(current_temp - SUPPLY_AIR_TEMP_C, 0.0)
        * (damper_position / 100.0)
    )

    q_person = Q_PERSON_KW * occupancy
    q_equipment = EQUIPMENT_HEAT_LOAD_KW.get(room_type, 0.0)
    q_env = ua * (outdoor_temp - current_temp)
    q_net = q_person + q_equipment + q_env - cooling_kw  # kW

    dT_per_min = q_net * 60.0 / c_thermal
    noise = random.gauss(0, TEMP_NOISE_SIGMA) if add_noise else 0.0
    new_temp = current_temp + dT_per_min * dt_minutes + noise
    return new_temp, cooling_kw


def step_humidity(
    current_humidity: float,
    occupancy: int,
    damper_position: float,
    dt_minutes: float = 5.0,
) -> float:
    target = _clip(
        HUMIDITY_TARGET_BASE + occupancy * 0.8 - (damper_position / 100.0) * 8,
        25.0,
        70.0,
    )
    new_humidity = (
        current_humidity
        + (target - current_humidity) * HUMIDITY_ALPHA
        + random.gauss(0, HUMIDITY_NOISE_SIGMA)
    )
    return _clip(new_humidity, 20.0, 80.0)


def compute_energy_consumption(
    cooling_power_kw: float, airflow_cfm: float, dt_minutes: float = 5.0
) -> float:
    """Return kWh consumed over the interval (not instantaneous kW)."""
    fan_kw = FAN_POWER_COEFF * airflow_cfm
    total_kw = cooling_power_kw / COP + fan_kw
    return total_kw * (dt_minutes / 60.0)
