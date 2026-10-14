# Disaster Relief Resource Distribution Planner

> An Emergency Operations Decision-Support System powered **exclusively by Pure Classical Artificial Intelligence** (A* Heuristic Search and Multi-Objective Genetic Algorithms). Strictly **0% Machine Learning / Deep Learning**.

---

## 🌟 Executive Overview

During natural disasters (cyclones, earthquakes, flash floods, landslides), disaster response agencies must make rapid, mission-critical decisions regarding resource distribution (food, water, medicine, blankets, and emergency kits) across damaged and partially blocked road networks.

The **Disaster Relief Resource Distribution Planner** combines:
1. **Classical A* Search Algorithm**: Computes optimal shortest route paths across road topologies, taking into account terrain multipliers (paved, unpaved, damaged) while **strictly avoiding blocked or collapsed roads**.
2. **Classical Genetic Algorithm (GA)**: Solves the NP-hard Capacitated Multi-Depot Multi-Vehicle Routing and Allocation Problem over 300 generations (100 population, Tournament Selection, Order Crossover OX1, Swap Mutation).

---

## 🚫 AI Guarantee: 100% Classical AI — 0% Machine Learning / Deep Learning

| Attribute | Implementation Status | Method |
| :--- | :--- | :--- |
| **Pathfinding & Obstacle Avoidance** | ✅ **Classical A* Search** | Priority Queue ($heapq$), Great-Circle Haversine Heuristic $h(n)$ |
| **Fleet Assignment & Scheduling** | ✅ **Classical Genetic Algorithm** | 300 Generations, Tournament Selection ($k=4$), OX1 Crossover, 5% Swap Mutation |
| **Graph Topology & Validation** | ✅ **NetworkX** | Connected components, reachability analysis, all-pairs distance matrix |
| **Machine Learning / Deep Learning** | ❌ **Strictly Zero (0%)** | Zero TensorFlow, PyTorch, Scikit-Learn, OpenCV AI models, or neural networks |

---

## 🏗️ Clean System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    FRONTEND (React + TS + Tailwind CSS)               |
|                                                                                       |
|  [Emergency Operations Dashboard]  [Interactive Map (Leaflet)]  [Planner & Dispatch]  |
|  [Warehouse Manager]  [Affected Area Manager]  [Road Network]  [Fleet Manager]        |
|  [A* Step Visualizer]  [Genetic Algorithm Visualizer]  [PDF Report Generator]         |
+-------------------------------------------+-------------------------------------------+
                                            | REST API (JSON & Stream)
                                            v
+---------------------------------------------------------------------------------------+
|                                   BACKEND (FastAPI + Python)                          |
|                                                                                       |
|  [API Routes & Schemas] <---> [Business Logic & Validation Services]                  |
|                                    |                        |                         |
|                                    v                        v                         |
|                 +----------------------------+   +----------------------------+       |
|                 |    A* SEARCH ALGORITHM     |   |     GENETIC ALGORITHM      |       |
|                 | - Priority Queue (Heap)    |   | - Multi-truck Chromosomes  |       |
|                 | - Obstacle / Block Filter  |   | - Tournament Selection     |       |
|                 | - Haversine Heuristic      |   | - Order Crossover (OX1)    |       |
|                 | - Step-by-Step Trace Log   |   | - Swap Mutation (5%)       |       |
|                 +----------------------------+   | - Multi-Objective Fitness  |       |
|                                                  +----------------------------+       |
|                                    |                                                  |
|                                    v                                                  |
|                   [NetworkX Graph Model & SQLite Database]                            |
|                   [ReportLab Dynamic PDF Report Engine]                               |
+---------------------------------------------------------------------------------------+
```

---

## 📁 Repository Directory Structure

```
FOAI/
├── backend/
│   ├── algorithms/
│   │   ├── __init__.py
│   │   ├── astar.py              # Pure Classical A* Search & Visualizer Tracer
│   │   ├── genetic.py            # Pure Classical GA Multi-Vehicle Optimizer
│   │   └── graph.py              # NetworkX graph topology and matrix generator
│   ├── tests/
│   │   ├── test_astar.py         # Unit tests for A* search & blocked roads
│   │   ├── test_genetic.py       # Unit tests for GA operators & convergence
│   │   └── test_api.py           # Integration tests for FastAPI endpoints
│   ├── database.py               # SQLite & SQLAlchemy engine configuration
│   ├── models.py                 # SQLAlchemy ORM Data Models
│   ├── schemas.py                # Pydantic v2 Request/Response Validation Schemas
│   ├── services.py               # Business logic, pipeline orchestration, seeding
│   ├── routes.py                 # FastAPI REST API Controllers
│   ├── scenarios.py              # Preset disaster scenarios (Cyclone, Earthquake)
│   ├── report_generator.py       # ReportLab PDF Generation Engine
│   ├── main.py                   # FastAPI server entry point
│   └── requirements.txt          # Python classical dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/           # Navbar, Sidebar, ThemeToggle, ScenarioSelector
│   │   │   ├── common/           # StatCard, Modal, Badge, Button, LoadingSpinner
│   │   │   ├── map/              # ReliefMap (Leaflet), MapLegend
│   │   │   ├── planner/          # TruckAssignmentCard, ResourceFulfillmentTable
│   │   │   ├── visualizer/       # AStarVisualizer, GeneticVisualizer
│   │   │   ├── warehouses/       # WarehouseModal
│   │   │   ├── affected/         # AffectedAreaModal
│   │   │   ├── roads/            # RoadModal
│   │   │   └── trucks/           # TruckModal
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx # Emergency Operations Dashboard
│   │   │   ├── PlannerPage.tsx   # AI Distribution Planner & Dispatch
│   │   │   ├── MapPage.tsx       # Tactical GIS Command Map
│   │   │   ├── AStarVisualizerPage.tsx   # Step-by-Step A* Visualizer
│   │   │   ├── GeneticVisualizerPage.tsx # GA Evolution Visualizer & Convergence
│   │   │   ├── WarehousesPage.tsx        # Supply Depots Inventory Manager
│   │   │   ├── AffectedAreasPage.tsx     # Disaster Zones Demand Manager
│   │   │   ├── RoadNetworkPage.tsx       # Roads & Blocked Status Manager
│   │   │   ├── TrucksPage.tsx            # Fleet Trucks Manager
│   │   │   ├── ReportsPage.tsx           # Audit Logs & PDF Exporter
│   │   │   └── DocumentationPage.tsx     # Classical AI Documentation
│   │   ├── services/
│   │   │   └── api.ts            # Typed Axios API Client
│   │   ├── types/
│   │   │   └── index.ts          # Domain TypeScript Interfaces
│   │   ├── App.tsx               # Main routing & application state
│   │   ├── index.css             # Tailwind CSS tokens, animations, scrollbars
│   │   └── main.tsx              # React DOM initialization
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── index.html
└── README.md
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**

### 1. Start the Backend (FastAPI + SQLite)
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```
Application interface will be live at: `http://localhost:5173`

---

## 🧪 Running Automated Classical AI Tests
```bash
# Run A* Pathfinding Unit Tests:
python -m backend.tests.test_astar

# Run Genetic Algorithm Unit Tests:
python -m backend.tests.test_genetic

# Run API Integration Tests:
python -m backend.tests.test_api
```

---

## 📑 Algorithmic Details

### 1. A* Heuristic Search Formulation
$$f(n) = g(n) + h(n)$$
- $g(n)$: Exact accumulated distance from start node to node $n$, weighted by road condition multiplier (Paved = 1.0, Unpaved = 1.25, Damaged = 1.5).
- $h(n)$: Great-circle Haversine distance heuristic from node $n$ to goal coordinates. Admissible and consistent.
- **Blocked Roads**: Pruned completely during adjacency expansion.

### 2. Genetic Algorithm Optimization Formulation
$$\text{Fitness}(C) = + \text{Rewards} - \text{Penalties}$$
- **Rewards**: $+3.0 \times (\text{Delivered} \times \text{Severity Weight}) + 2000 \times \text{Coverage Ratio}$
- **Penalties**: $-80 \times \text{Overload Units} - 100 \times \text{Fuel Overuse} - 1.5 \times \text{Distance} - 500 \times \text{Blocked Violations}$
- **Tournament Selection**: $k=4$ candidates showdown.
- **Order Crossover (OX1)**: Contiguous sequence preservation guaranteeing valid permutations.
- **Swap Mutation (5%)**: Stochastic permutation of stops and truck assignments.

---

## 📄 License
MIT License. Built for Disaster Relief Operations Command Centers using Pure Classical AI.
