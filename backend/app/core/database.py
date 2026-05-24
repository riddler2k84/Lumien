from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from fastapi import Request
from app.core.config import settings

# ── Production DB ─────────────────────────────────────────────────────────────
prod_engine = create_engine(
    settings.PRODUCTION_DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)
ProdSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=prod_engine)

# ── Demo DB ───────────────────────────────────────────────────────────────────
demo_engine = create_engine(
    settings.DEMO_DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)
DemoSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=demo_engine)

# Legacy aliases (kept for seed scripts and backward compat)
engine = prod_engine
SessionLocal = ProdSessionLocal


class Base(DeclarativeBase):
    pass


def get_db(request: Request):
    """Tenant-aware DB session.  Reads the X-Tenant header to pick the right DB."""
    tenant = request.headers.get("X-Tenant", "production")
    Factory = DemoSessionLocal if tenant == "demo" else ProdSessionLocal
    db = Factory()
    try:
        yield db
    finally:
        db.close()
