from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List
from datetime import date, timedelta
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.attendance import AttendanceSession, AttendanceRecord, AbsenceExcusal, SessionStatus, AttendanceStatus, ExcusalStatus
from app.models.academic import Enrollment, ClassSection
from app.models.users import User, Student
from app.schemas.attendance import (
    MarkAttendanceRequest, AttendanceSessionResponse,
    ExcusalCreate, ExcusalResponse, AttendanceSummary
)

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/sessions/today", response_model=List[AttendanceSessionResponse])
def get_today_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    q = db.query(AttendanceSession).filter(AttendanceSession.date == today)
    if current_user.role.value == "teacher":
        teacher = current_user.teacher_profile
        q = q.filter(AttendanceSession.teacher_id == teacher.id)
    return q.all()


@router.post("/sessions/{session_id}/mark", response_model=AttendanceSessionResponse)
def mark_attendance(
    session_id: int,
    payload: MarkAttendanceRequest,
    current_user: User = Depends(require_roles("teacher", "admin", "schedule_admin", "headmaster")),
    db: Session = Depends(get_db),
):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if current_user.role.value == "teacher" and session.teacher_id != current_user.teacher_profile.id:
        raise HTTPException(403, "Not your session")

    student_ids = {e.student_id for e in db.query(Enrollment).filter(
        Enrollment.class_section_id == session.class_section_id).all()}

    for rec in payload.records:
        if rec.student_id not in student_ids:
            raise HTTPException(400, f"Student {rec.student_id} not enrolled in this section")
        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.attendance_session_id == session_id,
            AttendanceRecord.student_id == rec.student_id,
        ).first()
        if existing:
            existing.status = rec.status
            existing.minutes_late = rec.minutes_late
            existing.notes = rec.notes
        else:
            db.add(AttendanceRecord(
                attendance_session_id=session_id,
                student_id=rec.student_id,
                status=rec.status,
                minutes_late=rec.minutes_late,
                notes=rec.notes,
            ))

    from datetime import datetime, timezone
    session.status = SessionStatus.marked
    session.marked_at = datetime.now(timezone.utc)
    session.marked_by = current_user.id
    db.commit()
    db.refresh(session)
    return session


@router.get("/summary/{student_id}", response_model=AttendanceSummary)
def student_summary(student_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(AttendanceRecord.status, func.count()).filter(
        AttendanceRecord.student_id == student_id
    ).group_by(AttendanceRecord.status).all()

    counts = {r[0]: r[1] for r in rows}
    total = sum(counts.values())
    present = counts.get(AttendanceStatus.present, 0)
    late = counts.get(AttendanceStatus.late, 0)
    absent = counts.get(AttendanceStatus.absent, 0)
    excused = counts.get(AttendanceStatus.excused, 0)

    return AttendanceSummary(
        student_id=student_id,
        total_sessions=total,
        present=present, absent=absent, late=late, excused=excused,
        attendance_rate=round((present + late + excused) / total * 100, 2) if total else 0.0,
    )


@router.get("/dashboard")
def attendance_dashboard(
    days: int = 30,
    current_user: User = Depends(require_roles("admin", "headmaster", "schedule_admin", "teacher")),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)

    # Overall counts in period
    total_records = db.query(func.count(AttendanceRecord.id)).join(AttendanceSession).filter(
        AttendanceSession.date >= since
    ).scalar()

    status_counts = dict(db.query(AttendanceRecord.status, func.count()).join(AttendanceSession).filter(
        AttendanceSession.date >= since
    ).group_by(AttendanceRecord.status).all())

    overall_rate = round(
        (status_counts.get(AttendanceStatus.present, 0) +
         status_counts.get(AttendanceStatus.late, 0) +
         status_counts.get(AttendanceStatus.excused, 0)) / total_records * 100, 1
    ) if total_records else 0.0

    # Daily trend (last 14 days)
    daily_trend = []
    for i in range(min(days, 14), 0, -1):
        day = date.today() - timedelta(days=i)
        if day.weekday() >= 5:
            continue
        day_total = db.query(func.count(AttendanceRecord.id)).join(AttendanceSession).filter(
            AttendanceSession.date == day
        ).scalar()
        day_present = db.query(func.count(AttendanceRecord.id)).join(AttendanceSession).filter(
            AttendanceSession.date == day,
            AttendanceRecord.status.in_([AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.excused]),
        ).scalar()
        daily_trend.append({
            "date": str(day),
            "rate": round(day_present / day_total * 100, 1) if day_total else 0.0,
            "total": day_total,
        })

    # By grade level
    grade_breakdown = []
    for grade in range(1, 13):
        grade_total = db.query(func.count(AttendanceRecord.id)).join(AttendanceSession).join(
            ClassSection, AttendanceSession.class_section_id == ClassSection.id
        ).filter(
            AttendanceSession.date >= since,
            ClassSection.grade_level == grade,
        ).scalar()
        grade_present = db.query(func.count(AttendanceRecord.id)).join(AttendanceSession).join(
            ClassSection, AttendanceSession.class_section_id == ClassSection.id
        ).filter(
            AttendanceSession.date >= since,
            ClassSection.grade_level == grade,
            AttendanceRecord.status.in_([AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.excused]),
        ).scalar()
        if grade_total:
            grade_breakdown.append({
                "grade": grade,
                "rate": round(grade_present / grade_total * 100, 1),
                "total_records": grade_total,
            })

    # Chronic absentees (attendance < 80% with at least 10 sessions)
    chronic = db.query(
        AttendanceRecord.student_id,
        func.count(AttendanceRecord.id).label("total"),
        func.sum(case((AttendanceRecord.status == AttendanceStatus.absent, 1), else_=0)).label("absences"),
    ).join(AttendanceSession).filter(
        AttendanceSession.date >= since
    ).group_by(AttendanceRecord.student_id).having(
        func.count(AttendanceRecord.id) >= 10
    ).all()

    chronic_list = []
    for row in chronic:
        rate = round((row.total - row.absences) / row.total * 100, 1)
        if rate < 80:
            student = db.query(Student).get(row.student_id)
            chronic_list.append({
                "student_id": row.student_id,
                "student_name": student.user.full_name if student else "Unknown",
                "student_code": student.student_code if student else "",
                "grade": student.grade_level if student else 0,
                "attendance_rate": rate,
                "absences": row.absences,
                "total_sessions": row.total,
            })
    chronic_list.sort(key=lambda x: x["attendance_rate"])

    return {
        "period_days": days,
        "overall_rate": overall_rate,
        "total_records": total_records,
        "status_breakdown": {k.value: v for k, v in status_counts.items()},
        "daily_trend": daily_trend,
        "grade_breakdown": grade_breakdown,
        "chronic_absentees": chronic_list[:20],
        "chronic_count": len(chronic_list),
    }


@router.post("/excusals", response_model=ExcusalResponse)
def submit_excusal(
    payload: ExcusalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    excusal = AbsenceExcusal(**payload.model_dump(), submitted_by=current_user.id)
    db.add(excusal)
    db.commit()
    db.refresh(excusal)
    return excusal


@router.patch("/excusals/{excusal_id}/review")
def review_excusal(
    excusal_id: int,
    approve: bool,
    current_user: User = Depends(require_roles("admin", "headmaster")),
    db: Session = Depends(get_db),
):
    excusal = db.get(AbsenceExcusal, excusal_id)
    if not excusal:
        raise HTTPException(404, "Excusal not found")
    from datetime import datetime, timezone
    excusal.status = ExcusalStatus.approved if approve else ExcusalStatus.rejected
    excusal.reviewed_by = current_user.id
    excusal.reviewed_at = datetime.now(timezone.utc)

    if approve:
        records = db.query(AttendanceRecord).join(AttendanceSession).filter(
            AttendanceRecord.student_id == excusal.student_id,
            AttendanceSession.date >= excusal.date_from,
            AttendanceSession.date <= excusal.date_to,
            AttendanceRecord.status == AttendanceStatus.absent,
        ).all()
        for r in records:
            r.status = AttendanceStatus.excused

    db.commit()
    return {"status": "ok"}
