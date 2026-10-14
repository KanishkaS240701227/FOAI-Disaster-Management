# Chennai Relief Control

Plans where relief supplies should go and how trucks should get there, for **all of Chennai plus Avadi, Pallavaram, Chrompet and Tambaram**. It watches live rain, wind and earthquake data, turns it into a 0-100 disaster meter, finds the areas most likely to need help, and dispatches a fleet from the depots with clock-time ETAs for every delivery.

Everything that makes a decision is classical AI - **A\* search** for routes and a **genetic algorithm** for assigning trucks and visiting order, with rule-based hazard scoring. There is no machine learning, so every number can be traced back to a rule.

## Run it

Windows: double-click `start.bat`. Mac/Linux: `./start.sh`. Then open <http://localhost:5273>.

Or by hand:

```
python -m venv .venv && .venv\Scripts\activate        # source .venv/bin/activate on Mac/Linux
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --port 8765        # API

cd frontend
npm install
npm run dev                                           # web app
```

**First start:** the API downloads Chennai's real road network from OpenStreetMap in the background (about 1-2 minutes, needs internet). Until it finishes, plans use an approximate network and the app says so. After that the roads are cached in `backend/data/chennai/roads_osm.json`.

The 3D basemap (OpenFreeMap) and the live feeds (Open-Meteo, USGS) also need internet. Without it the map shows a notice and the app keeps working from the last saved readings.

## What is in the app

| Page | What it does |
| --- | --- |
| **Map** | A clean 3D map of Chennai and its four suburbs: each zone rises from the map (taller where more people live, coloured by risk), a column marks every area needing relief (taller means more people affected) and real buildings stand up as you zoom in. Switch between 2D and 3D at the top right. Choose *Right now*, a past event (Cyclones Michaung, Fengal and Vardah, the 2015 floods) or a practice drill from the top bar. Three buttons at the top left open popups: *Disaster meter* (the meter, current conditions and the 48-hour forecast), *Areas by risk* (every zone, searchable, highest first) and *Layers*. Click a depot, area, zone or road and the map flies in to it (and zooms back out when you close the card) and opens a card with real photos of the place (from Wikipedia and Wikimedia Commons, with credit), the numbers, and links to Google Maps and Street View. Click a road to close or reopen it. |
| **Dispatch** | Plans the truck runs for you. When areas are flagged, the plan is made as soon as you open the page; if nothing is flagged, pick a real event (Cyclone Michaung, the 2015 floods, a drill…) and it plans that. The top card says when the first delivery lands, when the critical areas are reached, how many people are reached and what share of the need is met, and lists what the depots are short of. *Areas* lists every area worst-first with arrival time, truck and how much it gets (click one to see items delivered vs needed and fly to it); *Trucks* gives each truck a timed run sheet; *Explain a route* replays A\* step by step on the map. Scrub the time bar or press play to watch trucks move, and download the PDF run sheets. *Adjust the plan* sets how long to search and how many areas to cover. |
| **Resources** | Depots and their stock, the fleet, areas needing relief, and road closures. Add, edit or remove any of them. |
| **Reports** | Every plan made so far, reopenable, with a PDF run sheet for each. |

## How decisions are made

1. **Disaster meter.** Per zone, rain (24 h and 72 h totals), wind gusts, storm surge and earthquake shaking are scored against IMD warning thresholds and an earthquake attenuation rule, then weighted by how flood-prone and densely built the zone is. The city meter blends the worst zone with the population-weighted average.
2. **Areas needing relief.** Known flood hotspots (57 recorded in past events) light up in proportion to the live rain, wind and quake score of their zone. People affected, severity and demand for food, water, medicine, blankets and kits follow from that. You can add your own areas too.
3. **Roads.** A\* runs on the OpenStreetMap road graph. Travel time per road = length / speed, where speed drops with flooding in the surrounding zone; badly flooded roads close. Operators can close or reopen roads by hand. The heuristic is straight-line distance at top speed, which never overestimates, so A\* returns the fastest route.
4. **Dispatch.** The genetic algorithm (tournament selection, order crossover, swap mutation) assigns areas to trucks and orders each truck's stops. It rewards covering the most severe areas first and penalises distance, overloaded trucks and fuel overruns. Trucks leave the plan start time, spend 18 minutes at each stop, and ETAs are real clock times in IST.

## Data and licences

- Zone and ward boundaries: Datameet / Transparent Chennai (CC BY-SA 2.5 IN).
- Avadi, Tambaram and Pallavaram boundaries, roads and the basemap: OpenStreetMap contributors (ODbL). Chrompet is an approximate split of the Pallavaram boundary.
- Live weather: Open-Meteo. Earthquakes: USGS.
- Place photos: Wikipedia and Wikimedia Commons, fetched in your browser when you open a place and cached for a few days. Each photo shows its photographer and licence; click it for the source. Photos need internet, and some places have none, in which case the card says so and links to a Commons search.
- Flood hotspots come from published reports and past-event coverage; **the 23 depots, the 46 trucks and their stock are placeholders** - replace them on the Resources page with your real depots before using the plans for anything real. Population per zone is a modelled estimate.

## Project layout

```
backend/            FastAPI service
  hazards.py          live feeds + rule-based hazard scoring
  scenarios.py        past events and drills
  roadnet.py          road graph, flood-adjusted speeds, closures, A* queries
  osm_import.py       downloads and compacts OpenStreetMap roads
  algorithms/         A* and the genetic algorithm
  services.py         dispatch planning, ETAs, A* explanation
  report_generator.py PDF run sheets
  data/chennai/       zones, outline, hotspots, depots, fallback network
  tests/              pytest suite
frontend/           React + TypeScript + MapLibre
  src/map/            basemap style, 3D overlay, interaction, fly-to camera
  src/lib/photos.ts   finds and ranks photos of a place on Wikimedia
  src/pages/          Map, Dispatch, Resources, Reports
```

Run the tests with `pip install -r backend/requirements-dev.txt` then `python -m pytest backend/tests`. Build the web app for production with `cd frontend && npm run build`.
