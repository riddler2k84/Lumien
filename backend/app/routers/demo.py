from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import demo_only

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/reset")
def reset_demo(request: Request, db: Session = Depends(get_db), _=Depends(demo_only)):
    """Wipe and re-seed all demo data. Only available in demo tenant."""
    from seeds.seed import run_seed
    run_seed(db, force=True, tenant="demo")
    return {"status": "ok", "message": "Demo data reset successfully"}


@router.get("/status")
def demo_status(request: Request):
    from app.core.config import settings
    tenant = request.headers.get("X-Tenant", "production")
    is_demo = tenant == "demo"
    return {
        "tenant": tenant,
        "is_demo": is_demo,
        "currency": settings.DEFAULT_CURRENCY,
        "currency_symbol": settings.CURRENCY_SYMBOL,
        "school_name": settings.APP_NAME,
        "school_short_name": settings.APP_SHORT_NAME,
        "school_type": settings.SCHOOL_TYPE,
        "school_country": settings.SCHOOL_COUNTRY,
    }
