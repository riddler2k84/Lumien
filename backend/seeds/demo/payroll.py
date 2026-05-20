import random
from datetime import date, timedelta
from decimal import Decimal
from app.models.payroll import (
    PayGrade, EmployeePay, PayComponent, PayPeriod, Payslip,
    PayslipLineItem, PayslipStatus, PayPeriodStatus, ComponentType
)
from app.models.users import User, UserRole

random.seed(42)

ROLE_GRADE_MAP = {
    UserRole.headmaster:     "Headmaster",
    UserRole.schedule_admin: "Schedule Administrator",
    UserRole.admin:          "Admin Staff Grade 2",
    UserRole.teacher:        "Teaching Staff Grade 2",  # default, randomized below
}

TEACHER_GRADES = [
    "Teaching Staff Grade 1",
    "Teaching Staff Grade 2",
    "Teaching Staff Grade 3",
    "Senior Teacher",
]


def seed_payroll(db, staff_users: list, teacher_users: list, pay_grades: list, pay_components: list,
                 current_term, admin_user_id: int):
    grade_map = {pg.name: pg for pg in pay_grades}
    components = pay_components

    all_payroll_users = staff_users + teacher_users
    effective_date = date(2025, 1, 1)

    # Assign pay grades
    for user in all_payroll_users:
        if user.role == UserRole.teacher:
            grade_name = random.choice(TEACHER_GRADES)
        else:
            grade_name = ROLE_GRADE_MAP.get(user.role, "Admin Staff Grade 1")
        grade = grade_map.get(grade_name)
        if grade:
            db.add(EmployeePay(user_id=user.id, pay_grade_id=grade.id, effective_date=effective_date))
    db.flush()

    # Pay periods — last 3 months
    pay_periods = []
    for months_ago in range(3, 0, -1):
        period_start = date(2026, 5, 1) - timedelta(days=months_ago * 30)
        period_end = period_start + timedelta(days=29)
        pay_date = period_end + timedelta(days=5)
        period = PayPeriod(
            academic_term_id=current_term.id,
            name=period_start.strftime("%B %Y") + " Payroll",
            start_date=period_start,
            end_date=period_end,
            pay_date=pay_date,
            status=PayPeriodStatus.paid,
        )
        db.add(period)
        pay_periods.append(period)
    db.flush()

    # Current open period
    current_period = PayPeriod(
        academic_term_id=current_term.id,
        name="May 2026 Payroll",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        pay_date=date(2026, 6, 5),
        status=PayPeriodStatus.open,
    )
    db.add(current_period)
    db.flush()

    # Generate payslips for past 3 periods
    for user in all_payroll_users:
        emp_pay = db.query(EmployeePay).filter(EmployeePay.user_id == user.id).first()
        if not emp_pay:
            continue
        base = emp_pay.pay_grade.base_salary

        for period in pay_periods:
            total_allowances = Decimal("0")
            total_deductions = Decimal("0")
            line_items_data = []

            for comp in components:
                value = comp.default_value
                amount = (base * Decimal(str(value)) / 100) if comp.is_percentage else Decimal(str(value))
                line_items_data.append((comp, amount))
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
                status=PayslipStatus.paid,
                approved_by=admin_user_id,
            )
            db.add(payslip)
            db.flush()

            for comp, amount in line_items_data:
                db.add(PayslipLineItem(
                    payslip_id=payslip.id,
                    pay_component_id=comp.id,
                    component_type=comp.component_type,
                    amount=amount,
                ))
    db.flush()
