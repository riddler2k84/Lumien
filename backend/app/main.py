from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.routers import auth, attendance, scheduling, fees, payroll, demo, users, dashboard
from app.routers import rooms, students, teachers


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import prod_engine, demo_engine, ProdSessionLocal, DemoSessionLocal, Base
    import app.models  # noqa: F401 – registers all models with Base

    # Ensure tables exist in both databases
    Base.metadata.create_all(bind=prod_engine)
    Base.metadata.create_all(bind=demo_engine)

    # Seed production DB if empty
    from app.models.users import User
    prod_db = ProdSessionLocal()
    try:
        if prod_db.query(User).count() == 0:
            print("[startup] Production DB is empty — seeding...")
            from seeds.seed import run_seed
            run_seed(prod_db, force=False, tenant="production")
    finally:
        prod_db.close()

    # Seed demo DB if it has no users (also covers partially-seeded state from a previous crash)
    demo_db = DemoSessionLocal()
    try:
        if demo_db.query(User).count() == 0:
            print("[startup] Demo DB needs seeding — clearing any partial state and seeding fresh...")
            from seeds.seed import run_seed
            run_seed(demo_db, force=True, tenant="demo")  # force=True wipes partial data first
    finally:
        demo_db.close()

    _setup_demo_scheduler()
    yield


def _setup_demo_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    from seeds.seed import run_seed
    from app.core.database import DemoSessionLocal

    scheduler = BackgroundScheduler()

    def nightly_reset():
        db = DemoSessionLocal()
        try:
            run_seed(db, force=True, tenant="demo")
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
    allow_headers=["*", "X-Tenant"],
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
app.include_router(teachers.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "currency": settings.DEFAULT_CURRENCY}
