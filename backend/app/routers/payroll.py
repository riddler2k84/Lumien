from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.payroll import (
    Payslip, PayPeriod, PayslipStatus, PayPeriodStatus,
    EmployeePay, PayComponent,
)
from app.models.users import User
from app.schemas.payroll import PayPeriodResponse, RunPayrollRequest

router = APIRouter(prefix="/api/payroll", tags=["payroll"])

# ── helpers ───────────────────────────────────────────────────────────────────

def _employer_contributions(base: float) -> dict:
    """Malaysian statutory employer contributions (not deducted from employee pay)."""
    epf_rate   = 0.13 if base <= 5000 else 0.12   # EPF employer 13% / 12%
    epf        = round(base * epf_rate, 2)
    socso_base = min(base, 4000)
    socso      = round(socso_base * 0.0175, 2)     # SOCSO employer 1.75%
    eis        = round(socso_base * 0.002,  2)     # EIS employer 0.2%
    total      = round(epf + socso + eis, 2)
    return {"epf": epf, "socso": socso, "eis": eis, "total": total}


def _serialise_payslip(p: Payslip) -> dict:
    """Return a payslip dict with named line items and employer contributions."""
    base = float(p.base_salary)
    line_items = [
        {
            "id": li.id,
            "pay_component_id": li.pay_component_id,
            "component_name": li.pay_component.name if li.pay_component else "",
            "component_type": li.component_type.value,
            "amount": float(li.amount),
        }
        for li in p.line_items
    ]
    ec     = _employer_contributions(base)
    gross  = base + float(p.total_allowances)
    ec["total_cost_to_employer"] = round(gross + ec["total"], 2)
    return {
        "id": p.id,
        "user_id": p.user_id,
        "pay_period_id": p.pay_period_id,
        "base_salary": base,
        "total_allowances": float(p.total_allowances),
        "total_deductions": float(p.total_deductions),
        "net_pay": float(p.net_pay),
        "status": p.status.value,
        "approved_by": p.approved_by,
        "approved_at": p.approved_at.isoformat() if p.approved_at else None,
        "line_items": line_items,
        "employer_contributions": ec,
    }


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/periods", response_model=List[PayPeriodResponse])
def list_periods(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    return db.query(PayPeriod).order_by(PayPeriod.start_date.desc()).all()


@router.get("/employees")
def list_employees_payroll(
    period_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    """
    Admin view: all teachers + staff with pay grade, latest paid payslip,
    and computed Malaysian employer contributions.
    """
    from app.models.users import Teacher, Staff, UserRole

    rows = []

    # ── Teachers ──────────────────────────────────────────────────────────────
    teachers = db.query(Teacher).join(Teacher.user).order_by(User.last_name).all()
    for t in teachers:
        u       = t.user
        emp_pay = db.query(EmployeePay).filter(EmployeePay.user_id == u.id).first()
        if not emp_pay:
            continue

        q = db.query(Payslip).filter(Payslip.user_id == u.id)
        if period_id:
            q = q.filter(Payslip.pay_period_id == period_id)
        else:
            q = q.filter(Payslip.status == PayslipStatus.paid)
        payslip = q.order_by(Payslip.id.desc()).first()

        base = float(emp_pay.pay_grade.base_salary)
        ec   = _employer_contributions(base)
        rows.append({
            "user_id":       u.id,
            "name":          u.full_name,
            "employee_code": t.employee_code,
            "type":          "Teacher",
            "department":    None,
            "pay_grade":     emp_pay.pay_grade.name,
            "base_salary":   base,
            "currency":      emp_pay.pay_grade.currency,
            "employer_contributions": ec,
            "payslip":       _serialise_payslip(payslip) if payslip else None,
        })

    # ── Staff ─────────────────────────────────────────────────────────────────
    staff_list = db.query(Staff).join(Staff.user).order_by(User.last_name).all()
    for s in staff_list:
        u       = s.user
        emp_pay = db.query(EmployeePay).filter(EmployeePay.user_id == u.id).first()
        if not emp_pay:
            continue

        q = db.query(Payslip).filter(Payslip.user_id == u.id)
        if period_id:
            q = q.filter(Payslip.pay_period_id == period_id)
        else:
            q = q.filter(Payslip.status == PayslipStatus.paid)
        payslip = q.order_by(Payslip.id.desc()).first()

        base = float(emp_pay.pay_grade.base_salary)
        ec   = _employer_contributions(base)
        rows.append({
            "user_id":       u.id,
            "name":          u.full_name,
            "employee_code": s.employee_code,
            "type":          u.role.value.replace("_", " ").title(),
            "department":    s.department,
            "pay_grade":     emp_pay.pay_grade.name,
            "base_salary":   base,
            "currency":      emp_pay.pay_grade.currency,
            "employer_contributions": ec,
            "payslip":       _serialise_payslip(payslip) if payslip else None,
        })

    rows.sort(key=lambda r: r["name"])
    return rows


@router.get("/payslips/me")
def my_payslips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current user's payslips — enriched with component names and employer contributions."""
    payslips = (
        db.query(Payslip)
        .filter(Payslip.user_id == current_user.id)
        .order_by(Payslip.id.desc())
        .all()
    )
    return [_serialise_payslip(p) for p in payslips]


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


@router.patch("/payslips/{payslip_id}/approve")
def approve_payslip(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "headmaster")),
    db: Session = Depends(get_db),
):
    payslip = db.get(Payslip, payslip_id)
    if not payslip:
        raise HTTPException(404, "Payslip not found")
    payslip.status     = PayslipStatus.approved
    payslip.approved_by = current_user.id
    payslip.approved_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "approved"}
