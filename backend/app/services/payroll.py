from sqlalchemy.orm import Session
from decimal import Decimal
from app.models.payroll import (
    PayPeriod, Payslip, PayslipLineItem, PayGrade, EmployeePay,
    PayComponent, EmployeePayComponent, ComponentType
)
from app.models.users import User, UserRole
from datetime import date


PAYROLL_ROLES = {UserRole.teacher, UserRole.admin, UserRole.schedule_admin, UserRole.headmaster}


def generate_payslips(db: Session, period: PayPeriod) -> int:
    staff_users = db.query(User).filter(User.role.in_(PAYROLL_ROLES), User.is_active == True).all()
    components = db.query(PayComponent).all()
    count = 0

    for user in staff_users:
        emp_pay = (
            db.query(EmployeePay)
            .filter(
                EmployeePay.user_id == user.id,
                EmployeePay.effective_date <= period.end_date,
            )
            .order_by(EmployeePay.effective_date.desc())
            .first()
        )
        if not emp_pay:
            continue

        base = emp_pay.pay_grade.base_salary
        overrides = {
            ec.pay_component_id: ec.override_value
            for ec in db.query(EmployeePayComponent).filter(EmployeePayComponent.user_id == user.id).all()
        }

        line_items = []
        total_allowances = Decimal("0")
        total_deductions = Decimal("0")

        for comp in components:
            value = overrides.get(comp.id, comp.default_value)
            if value is None:
                value = comp.default_value
            amount = (base * Decimal(str(value)) / 100) if comp.is_percentage else Decimal(str(value))

            line_items.append(PayslipLineItem(
                pay_component_id=comp.id,
                component_type=comp.component_type,
                amount=amount,
            ))
            if comp.component_type == ComponentType.allowance:
                total_allowances += amount
            else:
                total_deductions += amount

        net_pay = base + total_allowances - total_deductions
        payslip = Payslip(
            user_id=user.id,
            pay_period_id=period.id,
            base_salary=base,
            total_allowances=total_allowances,
            total_deductions=total_deductions,
            net_pay=net_pay,
        )
        db.add(payslip)
        db.flush()

        for li in line_items:
            li.payslip_id = payslip.id
            db.add(li)

        count += 1

    return count
