from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import demo_only

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/reset")
def reset_demo(db: Session = Depends(get_db), _=Depends(demo_only)):
    """Wipe and re-seed all demo data. Only available in demo mode."""
    from seeds.seed import run_seed
    run_seed(db, force=True)
    return {"status": "ok", "message": "Demo data reset successfully"}


@router.get("/status")
def demo_status():
    from app.core.config import settings
    return {
        "mode": settings.APP_MODE,
        "is_demo": settings.is_demo,
        "currency": settings.DEFAULT_CURRENCY,
        "currency_symbol": settings.CURRENCY_SYMBOL,
    }
