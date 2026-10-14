"""
Entry point for the Chennai Disaster Relief Planner backend.
FastAPI + classical AI (A* search and a genetic algorithm).  Run from the project root:

    uvicorn backend.main:app --reload
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from . import osm_import, runtime
from .database import init_db, SessionLocal
from .hazards import ENGINE
from .routes import router
from . import services

log = logging.getLogger("relief")


async def _live_loop():
    """Refresh live weather / earthquake feeds every 15 minutes and keep affected areas in sync."""
    loop = asyncio.get_running_loop()
    while True:
        try:
            await loop.run_in_executor(None, ENGINE.refresh_live)
            db = SessionLocal()
            try:
                if services.active_scenario_key(db) == "live":
                    await loop.run_in_executor(None, services.sync_areas_from_hazards, db)
            finally:
                db.close()
        except Exception as exc:  # never let the loop die
            log.warning("live refresh failed: %s", exc)
        await asyncio.sleep(ENGINE.REFRESH_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        services.seed_database_if_empty(db, default_scenario="live")
    finally:
        db.close()
    if not osm_import.osm_file_exists():
        osm_import.start_background_import(on_done=runtime.reload_road)
    task = asyncio.create_task(_live_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Chennai Disaster Relief Planner API",
    description="Resource distribution and fleet dispatch for Chennai, Avadi, Pallavaram, Chrompet and Tambaram. "
                "Powered exclusively by classical AI: A* search and a genetic algorithm.",
    version="2.0.0",
    lifespan=lifespan,
)
@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    """Say what went wrong instead of a bare 'Internal Server Error', and keep a copy next to the code."""
    log.exception("unhandled error on %s", request.url.path)
    try:
        import os, traceback
        from datetime import datetime
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "api_errors.log"), "a", encoding="utf-8") as fh:
            fh.write(f"--- {datetime.now().isoformat(timespec='seconds')} {request.method} {request.url.path}\n")
            fh.write("".join(traceback.format_exception(type(exc), exc, exc.__traceback__)))
    except Exception:
        pass
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8765, reload=True)
