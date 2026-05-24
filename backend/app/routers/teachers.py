from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.models.users import User, UserRole, Teacher
from app.models.academic import TeacherSubject, Subject

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


def _serialize(t: Teacher, db: Session) -> dict:
    from app.models.payroll import EmployeePay
    from app.models.scheduling import ScheduleEntry, ScheduleStatus, Schedule

    emp_pay = db.query(EmployeePay).filter(EmployeePay.user_id == t.user_id).first()

    active_schedule = db.query(Schedule).filter(Schedule.status == ScheduleStatus.active).first()
    class_count = 0
    if active_schedule:
        class_count = db.query(ScheduleEntry).filter(
            ScheduleEntry.schedule_id == active_schedule.id,
            ScheduleEntry.teacher_id == t.id,
        ).count()

    return {
        "id":              t.id,
        "user_id":         t.user_id,
        "name":            t.user.full_name,
        "first_name":      t.user.first_name,
        "last_name":       t.user.last_name,
        "email":           t.user.email,
        "employee_code":   t.employee_code,
        "max_weekly_hours": t.max_weekly_hours,
        "is_active":       t.user.is_active,
        "subjects": [
            {"id": ts.subject.id, "name": ts.subject.name, "code": ts.subject.code}
            for ts in t.subject_qualifications
        ],
        "pay_grade": emp_pay.pay_grade.name if emp_pay else None,
        "base_salary": float(emp_pay.pay_grade.base_salary) if emp_pay else None,
        "weekly_class_count": class_count,
    }


# ── Pydantic ──────────────────────────────────────────────────────────────────

class TeacherCreate(BaseModel):
    first_name:      str
    last_name:       str
    email:           str
    password:        str
    employee_code:   Optional[str] = None
    max_weekly_hours: int = 25
    subject_ids:     List[int] = []


class TeacherUpdate(BaseModel):
    first_name:      Optional[str]       = None
    last_name:       Optional[str]       = None
    email:           Optional[str]       = None
    employee_code:   Optional[str]       = None
    max_weekly_hours: Optional[int]      = None
    subject_ids:     Optional[List[int]] = None
    is_active:       Optional[bool]      = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_teachers(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    teachers = (
        db.query(Teacher)
        .join(Teacher.user)
        .order_by(User.last_name, User.first_name)
        .all()
    )
    return [_serialize(t, db) for t in teachers]


@router.post("/")
def create_teacher(
    payload: TeacherCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, f"Email '{payload.email}' is already registered")

    # Generate employee code if not supplied
    emp_code = payload.employee_code
    if not emp_code:
        from app.routers.users import _next_emp_code
        emp_code = _next_emp_code(db, "TCH", Teacher)
    elif db.query(Teacher).filter(Teacher.employee_code == emp_code).first():
        raise HTTPException(400, f"Employee code '{emp_code}' already taken")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole.teacher,
        is_active=True,
    )
    db.add(user)
    db.flush()

    teacher = Teacher(
        user_id=user.id,
        employee_code=emp_code,
        max_weekly_hours=payload.max_weekly_hours,
    )
    db.add(teacher)
    db.flush()

    _set_subjects(db, teacher.id, payload.subject_ids)
    db.commit()
    db.refresh(teacher)
    return _serialize(teacher, db)


@router.patch("/{teacher_id}")
def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(404, "Teacher not found")

    user = teacher.user

    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(400, f"Email '{payload.email}' already taken")
        user.email = payload.email

    if payload.employee_code and payload.employee_code != teacher.employee_code:
        if db.query(Teacher).filter(Teacher.employee_code == payload.employee_code).first():
            raise HTTPException(400, f"Employee code '{payload.employee_code}' already taken")
        teacher.employee_code = payload.employee_code

    if payload.first_name:    user.first_name      = payload.first_name
    if payload.last_name:     user.last_name        = payload.last_name
    if payload.max_weekly_hours is not None:
        teacher.max_weekly_hours = payload.max_weekly_hours
    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.subject_ids is not None:
        _set_subjects(db, teacher.id, payload.subject_ids)

    db.commit()
    db.refresh(teacher)
    return _serialize(teacher, db)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _set_subjects(db: Session, teacher_id: int, subject_ids: List[int]):
    """Replace the teacher's subject qualifications with the given list."""
    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id).delete()
    for sid in set(subject_ids):
        if db.get(Subject, sid):
            db.add(TeacherSubject(teacher_id=teacher_id, subject_id=sid))
    db.flush()
