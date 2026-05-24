from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.models.users import User, UserRole, Staff, Teacher, Student, Parent

router = APIRouter(prefix="/api/users", tags=["users"])

STAFF_ROLES = {UserRole.admin, UserRole.headmaster, UserRole.schedule_admin, UserRole.super_admin}


def _serialize(u: User) -> dict:
    return {
        "id":         u.id,
        "email":      u.email,
        "first_name": u.first_name,
        "last_name":  u.last_name,
        "role":       u.role.value,
        "is_active":  u.is_active,
        "student_id": u.student_profile.id if u.student_profile else None,
        "teacher_id": u.teacher_profile.id if u.teacher_profile else None,
        "parent_id":  u.parent_profile.id  if u.parent_profile  else None,
    }


# ── Pydantic models ───────────────────────���───────────────────────────────────

class UserCreate(BaseModel):
    first_name:    str
    last_name:     str
    email:         str
    password:      str
    role:          str
    # role-specific optional fields (filled in on dedicated pages; minimal defaults used here)
    department:    Optional[str] = None
    employee_code: Optional[str] = None
    phone:         Optional[str] = None
    grade_level:   Optional[int] = 1


class UserUpdate(BaseModel):
    first_name: Optional[str]  = None
    last_name:  Optional[str]  = None
    email:      Optional[str]  = None
    role:       Optional[str]  = None
    is_active:  Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str


# ── Endpoints ─────────────────────��──────────────────────────────────���────────

@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    users = db.query(User).order_by(User.last_name, User.first_name).all()
    return [_serialize(u) for u in users]


@router.post("/")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, f"Email '{payload.email}' is already registered")

    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(400, f"Unknown role '{payload.role}'")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Create minimal role profile so relations don't break
    if role == UserRole.teacher:
        # Generate employee code if not supplied
        emp_code = payload.employee_code or _next_emp_code(db, "TCH", Teacher)
        db.add(Teacher(user_id=user.id, employee_code=emp_code, max_weekly_hours=25))

    elif role == UserRole.student:
        from datetime import date
        scode = _next_student_code(db)
        db.add(Student(
            user_id=user.id,
            grade_level=payload.grade_level or 1,
            enrollment_date=date.today(),
            student_code=scode,
        ))

    elif role == UserRole.parent:
        db.add(Parent(user_id=user.id, phone=payload.phone or ""))

    elif role in STAFF_ROLES:
        dept = payload.department or role.value.replace("_", " ").title()
        emp_code = payload.employee_code or _next_emp_code(db, "STF", Staff)
        db.add(Staff(user_id=user.id, department=dept, employee_code=emp_code))

    db.commit()
    db.refresh(user)
    return _serialize(user)


@router.patch("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(400, f"Email '{payload.email}' already taken")

    if payload.role:
        try:
            user.role = UserRole(payload.role)
        except ValueError:
            raise HTTPException(400, f"Unknown role '{payload.role}'")

    for field in ("first_name", "last_name", "email", "is_active"):
        val = getattr(payload, field)
        if val is not None:
            setattr(user, field, val)

    db.commit()
    db.refresh(user)
    return _serialize(user)


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"status": "password updated"}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _next_emp_code(db: Session, prefix: str, model) -> str:
    """Auto-generate the next sequential employee code, e.g. TCH-016."""
    from sqlalchemy import func
    count = db.query(func.count(model.id)).scalar() or 0
    candidate = f"{prefix}-{count + 1:03d}"
    # Ensure uniqueness
    while db.query(model).filter(model.employee_code == candidate).first():
        count += 1
        candidate = f"{prefix}-{count + 1:03d}"
    return candidate


def _next_student_code(db: Session) -> str:
    from sqlalchemy import func
    count = db.query(func.count(Student.id)).scalar() or 0
    candidate = f"S{count + 1:05d}"
    while db.query(Student).filter(Student.student_code == candidate).first():
        count += 1
        candidate = f"S{count + 1:05d}"
    return candidate
