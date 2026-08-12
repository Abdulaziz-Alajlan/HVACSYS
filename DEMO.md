# AirWise demo script

A ~6-8 minute walkthrough. Run through it once end-to-end before presenting —
a couple of steps depend on current data state (see notes inline).

## Setup (before you're on stage)

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate
uvicorn app.main:app --port 8000

# Terminal 2 — keep the simulation moving so data looks alive
cd backend && source venv/bin/activate
python -m simulation.live_simulator

# Terminal 3 — frontend
npm run dev
```

Open `http://localhost:3000`. Confirm the dashboard loads with real numbers
(not all zeros) before you start talking — that means the backend connection
is good.

## 1. Frame the problem (30s)

"HVAC is one of the largest energy costs in a commercial building, and most
systems run on simple thermostats with no forecasting and no way to weigh
comfort against energy automatically. AirWise adds three things on top of a
real building simulator: a model that forecasts where each zone is headed,
an optimizer that recommends what to do about it, and a way to actually
apply that recommendation and watch the building respond."

## 2. Dashboard tour (90s)

Point at the top KPI row, then the AI Insights panel on the right.

- **Active Rooms / Cooling Load / Comfort Score** — live, computed from the
  8 real zones' latest sensor readings, not mocked.
- **Energy Savings** — this is the number to circle back to later. Right
  now it reflects AI recommendations currently pending; note that it can
  legitimately read close to 0 if every zone is already near its best
  achievable damper position — that's the optimizer correctly declining to
  "save energy" at the cost of comfort, not a bug.
- **AI Insights card** — Demand Forecast comes from the trained model's
  30-minute-ahead prediction compared to current draw; Peak Load Window is
  a historical-pattern read of the last 24h, not a guess; Comfort Risk
  counts rooms whose live comfort score has dropped.
- Scroll to the **room status table** — same 8 zones, same numbers as the
  tiles above. Point out that this consistency is deliberate: everything on
  this page reads from one real data source.

## 3. Predict → Recommend → Apply, from the Builder (2 min)

This is the core loop. Navigate to **HVAC Builder** (top nav).

1. Click on a room node whose name matches a real zone (**A-101, A-102,
   B-201, or B-202** in the default layout — check the properties panel
   shows AI controls, not the "no backend zone" note).
2. Click **AI Optimize**. A recommendation appears: action, projected
   temperature vs. doing nothing, and estimated energy change over the next
   30 minutes.
3. Talk through the reasoning while it's on screen: "the optimizer doesn't
   just chase the lowest energy number — it only trades comfort for energy
   savings once the zone is already close to its target. If a room is
   badly overheated, it'll always tell you to keep cooling, not cut it to
   save power."
4. Click **Apply**. This is the moment to emphasize: "this isn't updating a
   flag in a database — it runs a real physics tick with the new damper
   position and writes a new sensor reading, which is what the next
   prediction and recommendation will actually see."
5. Point at the connected damper node updating alongside the room.

## 4. Scenario injection (90s)

Still in the properties panel for the same (or another mapped) room:

- **Occupancy Surge** — forces the zone to its full capacity for one tick.
  Watch temperature/occupancy jump.
- **Hot Outdoor Period** — adds 12°C to the current outdoor reading for one
  tick, simulating a heat wave.
- **Blocked Damper** — freezes the damper at its current position,
  ignoring what the controller wants, simulating a stuck actuator.

"These exist to stress-test the optimizer in front of you instead of
waiting for a real heat wave — trigger one, then hit AI Optimize again and
show the recommendation adapting to the new state."

## 5. AI ON/OFF comparison (90s)

Back on the dashboard, click the **AI Optimization** toggle in the header.

- **AI OFF**: the app stops generating recommendations entirely — this is
  the real baseline, not a cosmetic label. Energy Savings drops to 0
  because there's nothing to compare against. Forecasts (Demand Forecast,
  predicted temps) stay live, since forecasting isn't the same as active
  control.
- **AI ON**: recommendations resume, Energy Savings reflects real
  optimizer-vs-baseline deltas again.

"That's the baseline-vs-AI comparison in one click — off is what the
building would do on its own P-controller, on is what the optimizer adds
on top."

## 6. Close (30s)

"Everything you saw — the forecasts, the recommendations, the applied
changes — came from a trained model and an optimizer running against a
physics-based simulator, not canned data. The architecture is built so the
simulator could be swapped for real BMS sensor feeds without changing
anything upstream."

## Known rough edges to preempt if asked

- All 8 zones can end up pinned at max damper during hot simulated
  conditions without reaching setpoint — the physics model's cooling
  capacity is a little undersized for that case. If asked, say so plainly:
  "the optimizer's behavior here is correct — hold full cooling rather than
  give up — the simulator's capacity is what's mistuned, not the AI logic."
- If recommendations keep coming back "maintain" for every zone you try,
  that's this same effect — let `live_simulator.py` run for a while before
  presenting (cooler night-time simulated hours make the "trim energy near
  setpoint" behavior visible), or mention it as a known simulator
  limitation rather than trying to force a different result live.
