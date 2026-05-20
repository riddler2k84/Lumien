from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import date, timedelta
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.users import User, Student, Teacher, UserRole
from app.models.academic import AcademicTerm, ClassSection, Enrollment
from app.models.scheduling import Schedule, ScheduleEntry, ScheduleStatus
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceStatus, SessionStatus
from app.models.fees import Invoice, InvoiceStatus, Payment
from app.models.payroll import PayPeriod, PayPeriodStatus, Payslip

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = current_user.role.value

    # Common counts
    total_students = db.query(func.count(Student.id)).scalar()
    total_teachers = db.query(func.count(Teacher.id)).scalar()
    active_term = db.query(AcademicTerm).filter(AcademicTerm.is_active == True).first()
    active_schedule = db.query(Schedule).filter(Schedule.status == ScheduleStatus.active).first()

    # Today's attendance rate
    today = date.today()
    today_sessions = db.query(func.count(AttendanceSession.id)).filter(
        AttendanceSession.date == today,
        AttendanceSession.status == SessionStatus.marked,
    ).scalar()
    today_records = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.session.has(AttendanceSession.date == today)
    ).scalar()
    today_present = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.session.has(AttendanceSession.date == today),
        AttendanceRecord.status.in_([AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.excused]),
    ).scalar()
    attendance_rate = round(today_present / today_records * 100, 1) if today_records else 0.0

    # Fees
    outstanding = db.query(func.coalesce(func.sum(Invoice.amount_outstanding), 0)).filter(
        Invoice.status.in_([InvoiceStatus.unpaid, InvoiceStatus.partial, InvoiceStatus.overdue])
    ).scalar()
    total_collected = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar()

    # Payroll
    open_period = db.query(PayPeriod).filter(PayPeriod.status == PayPeriodStatus.open).first()

    # Pending sessions today (for teachers)
    pending_sessions = 0
    if role == "teacher" and current_user.teacher_profile:
        pending_sessions = db.query(func.count(AttendanceSession.id)).filter(
            AttendanceSession.teacher_id == current_user.teacher_profile.id,
            AttendanceSession.date == today,
            AttendanceSession.status == SessionStatus.pending,
        ).scalar()

    # Overdue invoices
    overdue_count = db.query(func.count(Invoice.id)).filter(
        Invoice.status == InvoiceStatus.overdue,
    ).scalar()

    # Section count
    section_count = 0
    if active_term:
        section_count = db.query(func.count(ClassSection.id)).filter(
            ClassSection.academic_term_id == active_term.id
        ).scalar()

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "active_term": active_term.name if active_term else None,
        "active_schedule": active_schedule.id if active_schedule else None,
        "today_attendance_rate": attendance_rate,
        "today_sessions_marked": today_sessions,
        "pending_sessions_today": pending_sessions,
        "outstanding_fees": float(outstanding),
        "total_fees_collected": float(total_collected),
        "overdue_invoices": overdue_count,
        "open_pay_period": open_period.name if open_period else None,
        "section_count": section_count,
        "role": role,
    }
