# AirWise

AI-driven HVAC optimization: a physics-informed building simulator, an ML
model that forecasts zone temperature/energy 30 minutes ahead, an optimizer
that recommends damper positions, and a Next.js dashboard + drag-and-drop
system builder that both run on real backend data.

```
Simulator (physics) --> FastAPI + SQLite --> ML prediction --> Optimizer
                              ^                                    |
                              |                                    v
                        new readings <----- Apply <----- Recommendation
                              |
                              v
                  Dashboard  /  HVAC Builder  (Next.js)
```

## What's real vs. simulated

- **Real**: the FastAPI backend, the trained ML model, the optimizer, and
  every number the frontend displays are computed from actual stored data —
  nothing in the UI is `Math.random()`.
- **Simulated**: there's no physical building. `backend/simulation/physics.py`
  is a lumped-thermal-capacitance model (heat balance, not per-field
  randomness) that stands in for real sensors, seeded with 30 days of
  synthetic history across 8 zones.

## Quick start

### Backend (FastAPI, port 8000)

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python -m simulation.seed_database   # seeds 30 days x 8 zones (~1-2 min)
python -m app.ml.train               # trains the temp/energy predictor (~10s)

uvicorn app.main:app --reload --port 8000
```

`DATABASE_URL` (defaults to local SQLite) and `CORS_ORIGINS` (defaults to
`http://localhost:3000`) are env-configurable.

Optional — advance the simulation in real time in a second terminal so the
dashboard has moving data to show:

```bash
python -m simulation.live_simulator   # ticks every 5 min by default
```

### Frontend (Next.js, port 3000)

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Visit `/` for the dashboard, `/builder` for the HVAC system builder.

## Project structure

```
backend/
  app/
    main.py           FastAPI app, CORS, lifespan (creates tables, loads the ML model)
    models.py          SQLAlchemy models: Zone, SensorReading, Prediction, Recommendation
    routes/             zones, readings, predictions, recommendations, scenarios
    ml/
      features.py       shared feature engineering (training + live serving)
      train.py           trains LinearRegression/RandomForest/GradientBoosting, saves the best
      predictor.py       loads the trained model, serves POST /api/predict/{zone_id}
      optimizer.py       scores candidate damper positions (comfort + energy objective)
    live_tick.py         advances a zone one real tick, with optional overrides
                         (shared by "apply recommendation" and scenario injection)
  simulation/
    physics.py          thermal model: temperature, humidity, airflow, energy
    occupancy.py         per-room-type occupancy schedules
    weather.py            synthetic outdoor temperature (seasonal + diurnal)
    seed_database.py      seeds 30 days of history
    live_simulator.py     standalone CLI that ticks the simulation in real time

app/, components/, lib/    Next.js dashboard + HVAC Builder (App Router)
  lib/api.ts                typed fetch client for the backend
  lib/hvac-live-data.ts     maps backend data onto the dashboard's Room/KPI shapes
  lib/hvac-store.ts         dashboard state (zustand)
  lib/builder-store.ts      HVAC Builder state (zustand + @xyflow/react)
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| GET | `/api/zones` | list zones |
| GET | `/api/zones/{id}` | zone detail |
| POST | `/api/readings` | ingest a sensor reading |
| GET | `/api/zones/{id}/readings` | reading history |
| POST | `/api/predict/{zone_id}` | 30-min-ahead temperature/energy forecast |
| GET | `/api/zones/{id}/predictions` | prediction history |
| POST | `/api/recommendations/{zone_id}` | generate a damper recommendation |
| GET | `/api/zones/{id}/recommendations` | recommendation history |
| POST | `/api/recommendations/{id}/apply` | apply a recommendation — runs a real physics tick with the recommended damper position and persists the new reading |
| POST | `/api/zones/{id}/scenario` | inject `occupancy_surge`, `hot_outdoor_period`, or `blocked_damper` for one tick |

## How the pieces fit together

**Simulator.** `physics.py` models each zone as a lumped thermal mass: heat
gain from occupancy and equipment, heat exchange with outdoor air, and
cooling from conditioned airflow, integrated forward each 5-minute tick.
`compute_damper_response` is a simple proportional controller — the
"baseline" the optimizer compares itself against.

**Prediction.** `train.py` engineers features from sensor history (current
readings, a 15-minute temperature trend, cyclical time-of-day encoding,
zone static attributes) and compares three regression models on a
time-based split (with a gap to prevent target leakage across the split).
The winner is saved as a small joblib bundle and loaded once at API
startup — a missing or corrupt bundle fails the app at boot, not on the
first demo request.

**Optimization.** `optimizer.py` projects each candidate damper position
(0-100% in 5% steps) forward with the deterministic (noise-free) physics
model and scores it: a comfort deadband + quadratic penalty dominates once
a zone is meaningfully off-target, with energy only breaking ties near
setpoint. This matters — a naive linear comfort+energy objective will
"recommend" shutting off cooling in an overheated room because the energy
savings look good on paper.

**Apply / scenarios.** Both go through `live_tick.py`, which advances a
zone one real (noisy) tick from its latest reading with one input forced —
the recommended damper for "apply," or occupancy/outdoor-temp/damper for
scenario injection. This is what makes "apply" a real state mutation
instead of a status flag: the next reading, prediction, and recommendation
all see the result.

**Dashboard vs. HVAC Builder.** The dashboard (`/`) replaces its room data
wholesale with the 8 real backend zones. The Builder (`/builder`) is a
freeform, user-editable topology diagram, not a live view — room nodes are
matched to real zones by name where possible (4 of the default layout's
rooms match), and AI Optimize/Apply/scenario controls only appear for
those; unmatched or user-added rooms keep working as a pure design tool
with mock data.

## Known limitations

- The physics model's cooling capacity can be undersized relative to
  envelope heat gain under hot outdoor conditions, so zones sometimes sit
  at max damper without reaching setpoint. The optimizer correctly holds
  full cooling in that case rather than "saving energy" by giving up — but
  it does mean recommendations mostly read as "maintain" until outdoor
  conditions cool off or `live_simulator.py` has been run long enough to
  work through a full diurnal cycle.
- `CoolingUnit`/`Damper`/`Schedule`/`Issue`/`MaintenanceEvent` on the
  dashboard have no backend model yet and stay mock-generated (though
  issues/schedules are derived from the real room data where the existing
  generators already supported that).
- No authentication — this is a local/demo deployment, not hardened for
  multi-tenant or public use.

## Deployment

Backend on **Railway** (needs a persistent process + disk — Netlify's
serverless functions can't host a long-running simulator or a durable
SQLite file), frontend on **Netlify**. `backend/railway.json` is set up for
this; the account-level steps below can't be scripted and need to be done
once by whoever owns the Railway/Netlify accounts:

1. **Railway**: create a project from this repo, set the service's **root
   directory to `backend`**, and attach a **Volume** mounted at e.g. `/data`
   — without a volume, Railway's filesystem doesn't survive a redeploy, and
   the whole reason for choosing Railway over serverless was a persistent
   disk. Set `DATABASE_URL=sqlite:////data/hvac.db` and
   `CORS_ORIGINS=<your-netlify-url>` as environment variables. The backend
   self-seeds on first boot against an empty database (see `_seed_if_empty()`
   in `main.py`) and never re-seeds an already-populated one, so this only
   needs to happen once.
2. **Netlify**: point the existing frontend site's `NEXT_PUBLIC_API_URL`
   env var at the Railway service's public URL, then redeploy.
3. Optionally run `python -m simulation.live_simulator` as a second Railway
   service (or a scheduled/always-on process) so the deployed demo has
   moving data instead of a static seed snapshot.
