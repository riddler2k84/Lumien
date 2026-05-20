from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.payroll import Payslip, PayPeriod, PayslipStatus, PayPeriodStatus
from app.models.users import User
from app.schemas.payroll import PayslipResponse, PayPeriodResponse, RunPayrollRequest

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


@router.get("/periods", response_model=List[PayPeriodResponse])
def list_periods(db: Session = Depends(get_db), _=Depends(require_roles("admin", "headmaster", "schedule_admin"))):
    return db.query(PayPeriod).order_by(PayPeriod.start_date.desc()).all()


@router.post("/run")
def run_payroll(
    payload: RunPayrollRequest,
    current_user: User = Depends(require_roles("admin", "headmaster")),
    db: Session = Depends(get_db),
):
    from app.services.payroll import generate_payslips
    period = db.get(PayPeriod, payload.pay_period_id)
    if not period:
        raise HTTPException(404, "Pay period not found")
    if period.status != PayPeriodStatus.open:
        raise HTTPException(400, "Pay period is not open")

    count = generate_payslips(db, period)
    period.status = PayPeriodStatus.processing
    db.commit()
    return {"payslips_generated": count}


@router.get("/payslips/me", response_model=List[PayslipResponse])
def my_payslips(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Payslip).filter(Payslip.user_id == current_user.id).order_by(Payslip.created_at.desc()).all()


@router.patch("/payslips/{payslip_id}/approve")
def approve_payslip(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "headmaster")),
    db: Session = Depends(get_db),
):
    payslip = db.get(Payslip, payslip_id)
    if not payslip:
        raise HTTPException(404, "Payslip not found")
    payslip.status = PayslipStatus.approved
    payslip.approved_by = current_user.id
    payslip.approved_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "approved"}
