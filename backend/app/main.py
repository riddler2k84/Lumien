from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.routers import auth, attendance, scheduling, fees, payroll, demo, users, dashboard
from app.routers import rooms, students


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure any new tables (e.g. student_special_needs) are created on startup
    from app.core.database import engine, Base
    import app.models  # noqa: F401 – registers all models with Base
    Base.metadata.create_all(bind=engine)
    if settings.is_demo:
        _setup_demo_scheduler()
    yield


def _setup_demo_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    from seeds.seed import run_seed
    from app.core.database import SessionLocal

    scheduler = BackgroundScheduler()

    def nightly_reset():
        db = SessionLocal()
        try:
            run_seed(db, force=True)
        finally:
            db.close()

    scheduler.add_job(nightly_reset, "cron", **_parse_cron(settings.DEMO_RESET_CRON))
    scheduler.start()


def _parse_cron(expr: str) -> dict:
    minute, hour, day, month, day_of_week = expr.split()
    return dict(minute=minute, hour=hour, day=day, month=month, day_of_week=day_of_week)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(attendance.router)
app.include_router(scheduling.router)
app.include_router(fees.router)
app.include_router(payroll.router)
app.include_router(demo.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(rooms.router)
app.include_router(students.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": settings.APP_MODE, "currency": settings.DEFAULT_CURRENCY}
