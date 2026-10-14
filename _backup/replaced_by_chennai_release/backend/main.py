"""
Main entry point for Disaster Relief Resource Distribution Planner Backend.
FastAPI + Classical AI (A* Search & Genetic Algorithm).
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db, SessionLocal
from .services import seed_database_if_empty
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler: initializes tables and seeds database on startup."""
    init_db()
    db = SessionLocal()
    try:
        seed_database_if_empty(db, default_scenario="cyclone")
    finally:
        db.close()
    yield


app = FastAPI(
    title="Disaster Relief Resource Distribution Planner API",
    description="Emergency Management and Resource Logistics System powered exclusively by Classical Artificial Intelligence (A* Search Algorithm and Genetic Algorithm). Strictly 0% Machine Learning / Deep Learning.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
